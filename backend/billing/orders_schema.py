"""GraphQL for pay-as-you-go credit orders, pricing tiers and the configurable payment / support contact details."""
import html
from decimal import Decimal, InvalidOperation
import graphene
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from graphql import GraphQLError
from accounts.permissions import ctx, staff_only
from core.audit import audit
from core.system_mail import send_localized, send_system_email, wrap
from . import credits
from .models import CreditAccount, CreditOrder, CreditPrice, PaymentSettings


class CreditPriceType(graphene.ObjectType):
    channel = graphene.String()
    min_quantity = graphene.Int()
    unit_price = graphene.Float()

    def resolve_unit_price(self, info):
        return float(self.unit_price)


class PaymentSettingsType(graphene.ObjectType):
    currency = graphene.String()
    payment_instructions = graphene.String()
    support_phone = graphene.String()
    support_whatsapp = graphene.String()
    support_email = graphene.String()
    support_hours = graphene.String()
    max_order_quantity = graphene.Int()


class CreditBalanceType(graphene.ObjectType):
    sms = graphene.Int()
    email = graphene.Int()


class QuoteLineType(graphene.ObjectType):
    quantity = graphene.Int()
    unit_price = graphene.Float()
    subtotal = graphene.Float()


class QuoteType(graphene.ObjectType):
    sms = graphene.Field(QuoteLineType)
    email = graphene.Field(QuoteLineType)
    total = graphene.Float()
    currency = graphene.String()


class CreditOrderType(graphene.ObjectType):
    id = graphene.ID()
    reference = graphene.String()
    sms_quantity = graphene.Int()
    email_quantity = graphene.Int()
    sms_unit_price = graphene.Float()
    email_unit_price = graphene.Float()
    total = graphene.Float()
    currency = graphene.String()
    status = graphene.String()
    payment_reference = graphene.String()
    payment_note = graphene.String()
    paid_at = graphene.DateTime()
    admin_note = graphene.String()
    reviewed_at = graphene.DateTime()
    created_at = graphene.DateTime()
    organization_name = graphene.String()
    organization_sms_activated = graphene.Boolean()
    requested_by_email = graphene.String()

    def resolve_sms_unit_price(self, info): return float(self.sms_unit_price)
    def resolve_email_unit_price(self, info): return float(self.email_unit_price)
    def resolve_total(self, info): return float(self.total)
    def resolve_organization_name(self, info): return self.organization.name
    def resolve_organization_sms_activated(self, info): return self.organization.sms_activated
    def resolve_requested_by_email(self, info): return self.requested_by.email if self.requested_by_id else ""


def _line(d):
    return QuoteLineType(quantity=d["quantity"], unit_price=float(d["unit_price"]), subtotal=float(d["subtotal"]))


def _err(fn):
    try:
        return fn()
    except credits.OrderError as exc:
        raise GraphQLError(str(exc))


def _notify_team(subject, order, line):
    """Tell the platform team about a new order / payment so it can be approved quickly."""
    to = PaymentSettings.get().support_email
    if to:
        link = f"{settings.FRONTEND_URL}/admin"
        transaction.on_commit(lambda: send_system_email(to, subject, wrap(subject, line, link, "Open platform admin")))


def _order_line(o):
    parts = [f"{o.sms_quantity} SMS"] if o.sms_quantity else []
    parts += [f"{o.email_quantity} emails"] if o.email_quantity else []
    return f"{html.escape(o.organization.name)} ordered {' + '.join(parts)} for {o.currency} {o.total:,.0f} (ref {o.reference})."


class Query(graphene.ObjectType):
    credit_prices = graphene.List(CreditPriceType, description="Public pay-as-you-go price tiers")
    payment_settings = graphene.Field(PaymentSettingsType, description="Public payment instructions and support contacts")
    quote_credits = graphene.Field(QuoteType, sms_quantity=graphene.Int(), email_quantity=graphene.Int())
    credit_balance = graphene.Field(CreditBalanceType)
    credit_orders = graphene.List(CreditOrderType)

    def resolve_credit_prices(self, info):
        return CreditPrice.objects.all()

    def resolve_payment_settings(self, info):
        return PaymentSettings.get()

    def resolve_quote_credits(self, info, sms_quantity=0, email_quantity=0):
        q = _err(lambda: credits.quote(sms_quantity, email_quantity))
        return QuoteType(sms=_line(q["lines"]["sms"]), email=_line(q["lines"]["email"]), total=float(q["total"]),
                         currency=q["currency"])

    def resolve_credit_balance(self, info):
        org = ctx(info)[1]
        acc = CreditAccount.objects.filter(organization=org).first()
        return CreditBalanceType(sms=acc.sms_balance if acc else 0, email=acc.email_balance if acc else 0)

    def resolve_credit_orders(self, info):
        return ctx(info)[1].credit_orders.select_related("organization", "requested_by")[:50]


class CreateCreditOrder(graphene.Mutation):
    """Step 1: the customer chooses quantities; the price is calculated here, never trusted from the browser."""
    class Arguments:
        sms_quantity = graphene.Int()
        email_quantity = graphene.Int()

    order = graphene.Field(CreditOrderType)

    def mutate(self, info, sms_quantity=0, email_quantity=0):
        user, org, _ = ctx(info, "billing")
        with transaction.atomic():
            order = _err(lambda: credits.create_order(org, user, sms_quantity, email_quantity))
            audit(org, user, "credit_order_created", f"{order.reference} {order.currency} {order.total}")
            _notify_team(f"New credit order {order.reference}", order, _order_line(order))
        return CreateCreditOrder(order=order)


class SubmitPayment(graphene.Mutation):
    """Step 2: the customer says they have paid and gives the transaction ID, so the team can match it."""
    class Arguments:
        id = graphene.ID(required=True)
        payment_reference = graphene.String(required=True)
        note = graphene.String()

    order = graphene.Field(CreditOrderType)

    @transaction.atomic
    def mutate(self, info, id, payment_reference, note=""):
        user, org, _ = ctx(info, "billing")
        order = org.credit_orders.select_for_update().filter(pk=id).first()
        if not order:
            raise GraphQLError("Order not found.")
        if order.status not in CreditOrder.OPEN:
            raise GraphQLError("This order can no longer be changed.")
        ref = " ".join(payment_reference.split())[:80]
        if len(ref) < 4:
            raise GraphQLError("Enter the transaction ID from your payment confirmation.")
        order.payment_reference, order.payment_note = ref, (note or "").strip()[:300]
        order.status, order.paid_at = CreditOrder.PAYMENT_SUBMITTED, timezone.now()
        order.save()
        audit(org, user, "credit_order_paid", f"{order.reference} txn {ref}")
        _notify_team(f"Payment submitted for {order.reference}", order,
                     f"{_order_line(order)} Transaction ID: {html.escape(ref)}. Please verify and approve.")
        return SubmitPayment(order=order)


class CancelCreditOrder(graphene.Mutation):
    class Arguments:
        id = graphene.ID(required=True)

    ok = graphene.Boolean()

    def mutate(self, info, id):
        user, org, _ = ctx(info, "billing")
        n = org.credit_orders.filter(pk=id, status=CreditOrder.PENDING_PAYMENT).update(status=CreditOrder.CANCELLED)
        if not n:
            raise GraphQLError("This order can no longer be changed.")
        audit(org, user, "credit_order_cancelled", id)
        return CancelCreditOrder(ok=True)


# ---------------- Platform admin ----------------
class AdminQuery(graphene.ObjectType):
    admin_credit_orders = graphene.List(CreditOrderType, status=graphene.String())

    def resolve_admin_credit_orders(self, info, status=None):
        staff_only(info)
        qs = CreditOrder.objects.select_related("organization", "requested_by")
        return qs.filter(status=status) if status else qs[:200]


class ReviewCreditOrder(graphene.Mutation):
    """Step 3: a Platform Admin approves (credits are added once) or rejects with a reason."""
    class Arguments:
        id = graphene.ID(required=True)
        action = graphene.String(required=True)
        note = graphene.String()

    order = graphene.Field(CreditOrderType)

    def mutate(self, info, id, action, note=""):
        admin = staff_only(info)
        note = (note or "").strip()[:300]
        if action == "approve":
            order = _err(lambda: credits.approve(id, admin))
            if note:
                CreditOrder.objects.filter(pk=order.pk).update(admin_note=note)
        elif action == "reject":
            if not note:
                raise GraphQLError("Give a reason so the customer knows what to fix.")
            with transaction.atomic():
                order = CreditOrder.objects.select_for_update(of=("self",)).select_related("organization").filter(pk=id).first()
                if not order:
                    raise GraphQLError("Order not found.")
                if order.status not in CreditOrder.OPEN:
                    raise GraphQLError("This order can no longer be changed.")
                order.status, order.admin_note = CreditOrder.REJECTED, note
                order.reviewed_by, order.reviewed_at = admin, timezone.now()
                order.save()
        else:
            raise GraphQLError("Unknown action.")
        order.refresh_from_db()
        audit(order.organization, admin, f"credit_order_{action}", order.reference)
        if order.requested_by_id:
            u = order.requested_by
            send_localized(u.email, f"order_{'approved' if action == 'approve' else 'rejected'}", u.language,
                           f"{settings.FRONTEND_URL}/buy-credits", ref=order.reference, note=order.admin_note or "-")
        return ReviewCreditOrder(order=order)


class PriceTierInput(graphene.InputObjectType):
    min_quantity = graphene.Int(required=True)
    unit_price = graphene.Float(required=True)


class SetCreditPrices(graphene.Mutation):
    """Replace the price tiers of one channel. An empty list takes that channel off sale."""
    class Arguments:
        channel = graphene.String(required=True)
        tiers = graphene.List(graphene.NonNull(PriceTierInput), required=True)

    prices = graphene.List(CreditPriceType)

    @transaction.atomic
    def mutate(self, info, channel, tiers):
        admin = staff_only(info)
        if channel not in credits.CHANNELS:
            raise GraphQLError("Channel must be sms or email.")
        seen = set()
        rows = []
        for t in tiers:
            try:
                price = Decimal(str(t.unit_price)).quantize(Decimal("0.01"))
            except InvalidOperation:
                raise GraphQLError("Each tier needs a minimum quantity of at least 1 and a price above 0.")
            if t.min_quantity < 1 or price <= 0 or t.min_quantity in seen:
                raise GraphQLError("Each tier needs a minimum quantity of at least 1 and a price above 0.")
            seen.add(t.min_quantity)
            rows.append(CreditPrice(channel=channel, min_quantity=t.min_quantity, unit_price=price))
        CreditPrice.objects.filter(channel=channel).delete()
        CreditPrice.objects.bulk_create(rows)
        audit(None, admin, "credit_prices_saved", f"{channel}: " + ", ".join(f"{r.min_quantity}+@{r.unit_price}" for r in rows))
        return SetCreditPrices(prices=CreditPrice.objects.filter(channel=channel))


class UpdatePaymentSettings(graphene.Mutation):
    class Arguments:
        currency = graphene.String()
        payment_instructions = graphene.String()
        support_phone = graphene.String()
        support_whatsapp = graphene.String()
        support_email = graphene.String()
        support_hours = graphene.String()
        max_order_quantity = graphene.Int()

    settings = graphene.Field(PaymentSettingsType)

    def mutate(self, info, **kw):
        from django.core.validators import validate_email
        from django.core.exceptions import ValidationError
        admin = staff_only(info)
        cfg = PaymentSettings.get()
        email = (kw.get("support_email") or "").strip()
        if email:
            try:
                validate_email(email)
            except ValidationError:
                raise GraphQLError("Enter a valid email address.")
        limits = {"currency": 5, "support_phone": 30, "support_whatsapp": 30, "support_email": 254, "support_hours": 120}
        for k, v in kw.items():
            if v is None:
                continue
            if k == "max_order_quantity":
                cfg.max_order_quantity = max(1, v)
            elif k == "currency":
                cfg.currency = v.strip().upper()[:5] or cfg.currency
            elif k == "payment_instructions":
                cfg.payment_instructions = v.strip()
            else:
                setattr(cfg, k, v.strip()[:limits[k]])
        cfg.save()
        audit(None, admin, "payment_settings_saved", "")
        return UpdatePaymentSettings(settings=cfg)


class Mutation(graphene.ObjectType):
    create_credit_order = CreateCreditOrder.Field()
    submit_payment = SubmitPayment.Field()
    cancel_credit_order = CancelCreditOrder.Field()
    review_credit_order = ReviewCreditOrder.Field()
    set_credit_prices = SetCreditPrices.Field()
    update_payment_settings = UpdatePaymentSettings.Field()


def notify_plan_request(org, user, plan):
    to = PaymentSettings.get().support_email
    if to:
        line = (f"{html.escape(org.name)} ({html.escape(user.email)}) requested the {html.escape(plan.name)} plan "
                f"for {plan.currency} {plan.price:,.0f}. Activate it once payment is confirmed.")
        send_system_email(to, f"Plan request: {plan.name}", wrap("Plan request", line, f"{settings.FRONTEND_URL}/admin", "Open platform admin"))
