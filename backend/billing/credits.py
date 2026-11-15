"""
Pay-as-you-go credits: the customer chooses how many SMS / emails to buy, the price is calculated from the
admin-managed volume tiers (`CreditPrice`), an order with a payment reference is created, the customer pays using
`PaymentSettings.payment_instructions` and a Platform Admin approves it. Approval adds the credits to the
organisation's `CreditAccount` exactly once (row lock on the order + status check).

Purchased credits do not expire and are used after the plan's own quota (see services.consume_paid).
"""
import secrets
from decimal import ROUND_HALF_UP, Decimal
from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone
from .models import CreditAccount, CreditEntry, CreditOrder, CreditPrice, PaymentSettings

CHANNELS = ("sms", "email")
MAX_OPEN_ORDERS = 3
_REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"   # no 0/O/1/I


class OrderError(Exception):
    pass


def tiers(channel):
    return list(CreditPrice.objects.filter(channel=channel).order_by("min_quantity"))


def unit_price(channel, quantity):
    """Price per unit for buying `quantity` units: the tier with the highest min_quantity <= quantity."""
    best = None
    for t in tiers(channel):
        if quantity >= t.min_quantity:
            best = t.unit_price
    return best


def minimum(channel):
    first = CreditPrice.objects.filter(channel=channel).order_by("min_quantity").first()
    return first.min_quantity if first else None


def quote(sms_quantity, email_quantity):
    """Validate quantities and return the server-side price breakdown. Raises OrderError."""
    cfg = PaymentSettings.get()
    lines, total = {}, Decimal("0")
    for channel, qty in (("sms", sms_quantity), ("email", email_quantity)):
        qty = int(qty or 0)
        if qty < 0:
            raise OrderError("Quantities cannot be negative.")
        if qty > cfg.max_order_quantity:
            raise OrderError(f"The maximum per order is {cfg.max_order_quantity} {channel.upper()}.")
        price = Decimal("0")
        if qty:
            low = minimum(channel)
            if low is None:
                raise OrderError(f"{channel.upper()} credits are not on sale right now.")
            if qty < low:
                raise OrderError(f"The minimum order is {low} {channel.upper()}.")
            price = unit_price(channel, qty)
        subtotal = (price * qty).quantize(Decimal("0.01"), ROUND_HALF_UP)
        lines[channel] = {"quantity": qty, "unit_price": price, "subtotal": subtotal}
        total += subtotal
    if not (lines["sms"]["quantity"] or lines["email"]["quantity"]):
        raise OrderError("Choose how many SMS or emails you want to buy.")
    return {"lines": lines, "total": total, "currency": cfg.currency}


def _reference():
    return "PK-" + "".join(secrets.choice(_REF_ALPHABET) for _ in range(6))


def create_order(org, user, sms_quantity, email_quantity):
    q = quote(sms_quantity, email_quantity)
    if CreditOrder.objects.filter(organization=org, status__in=CreditOrder.OPEN).count() >= MAX_OPEN_ORDERS:
        raise OrderError("You already have several orders waiting. Pay or cancel one before placing another.")
    for _ in range(5):
        try:
            with transaction.atomic():
                return CreditOrder.objects.create(
                    reference=_reference(), organization=org, requested_by=user,
                    sms_quantity=q["lines"]["sms"]["quantity"], sms_unit_price=q["lines"]["sms"]["unit_price"],
                    email_quantity=q["lines"]["email"]["quantity"], email_unit_price=q["lines"]["email"]["unit_price"],
                    total=q["total"], currency=q["currency"])
        except IntegrityError:   # reference collision: try another
            continue
    raise OrderError("Could not create the order. Please try again.")


@transaction.atomic
def approve(order_id, admin):
    """Credit the organisation exactly once. Returns the order."""
    order = CreditOrder.objects.select_for_update(of=("self",)).select_related("organization").filter(pk=order_id).first()
    if not order:
        raise OrderError("Order not found.")
    if order.status not in CreditOrder.OPEN:
        raise OrderError("This order can no longer be changed.")
    CreditAccount.objects.get_or_create(organization=order.organization)
    CreditAccount.objects.filter(organization=order.organization).update(
        sms_balance=F("sms_balance") + order.sms_quantity, email_balance=F("email_balance") + order.email_quantity)
    for channel, qty in (("sms", order.sms_quantity), ("email", order.email_quantity)):
        if qty:
            CreditEntry.objects.create(organization=order.organization, channel=channel, kind=CreditEntry.PURCHASE,
                                       units=qty, order=order)
    now = timezone.now()
    order.status, order.reviewed_by, order.reviewed_at = CreditOrder.APPROVED, admin, now
    order.paid_at = order.paid_at or now
    order.save()
    return order


def balance(org, channel):
    acc = CreditAccount.objects.filter(organization=org).first()
    if not acc:
        return 0
    return acc.sms_balance if channel == "sms" else acc.email_balance


def consume(org, channel, units):
    """Atomically take `units` purchased credits. Returns False when the balance is too low."""
    field = "sms_balance" if channel == "sms" else "email_balance"
    return bool(CreditAccount.objects.filter(organization=org, **{f"{field}__gte": units})
                .update(**{field: F(field) - units}))


def record(org, channel, kind, units, message=None):
    CreditEntry.objects.create(organization=org, channel=channel, kind=kind, units=units, message=message)


@transaction.atomic
def refund(org, channel, units, message=None):
    field = "sms_balance" if channel == "sms" else "email_balance"
    CreditAccount.objects.get_or_create(organization=org)
    CreditAccount.objects.filter(organization=org).update(**{field: F(field) + units})
    record(org, channel, CreditEntry.REFUND, units, message)
