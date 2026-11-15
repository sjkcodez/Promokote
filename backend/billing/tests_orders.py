from django.test import Client, TestCase
from accounts.models import Organization, User
from accounts.tokens import make_jwt
from billing.models import CreditAccount, CreditEntry, CreditOrder, CreditPrice, PaymentSettings, Plan
from messaging.models import Message
from messaging.tests import gql

REGISTER = """mutation($e:String!){register(email:$e,password:"Str0ng-pass-1",fullName:"A B",organizationName:"Acme"){token}}"""
ORDER = """mutation($s:Int,$e:Int){createCreditOrder(smsQuantity:$s,emailQuantity:$e){order{id reference total status smsUnitPrice}}}"""
REVIEW = """mutation($i:ID!,$a:String!,$n:String){reviewCreditOrder(id:$i,action:$a,note:$n){order{status}}}"""
SEND = """mutation($c:String!,$r:String!,$b:String!){sendTest(channel:$c,recipient:$r,subject:"S",body:$b){message{status billingSource}}}"""


class CreditOrderTests(TestCase):
    def setUp(self):
        self.c = Client()
        Plan.objects.create(name="Free", price=0, sms_quota=1, email_quota=0, is_default=True)
        for ch, q, p in [("sms", 100, 30), ("sms", 1000, 25), ("email", 500, 5)]:
            CreditPrice.objects.create(channel=ch, min_quantity=q, unit_price=p)
        self.staff = make_jwt(User.objects.create_superuser("root@x.com", "Str0ng-pass-1"))

    def signup(self, email="a@x.com", activated=True):
        t = gql(self.c, REGISTER, {"e": email})["data"]["register"]["token"]
        User.objects.filter(email=email).update(email_verified=True)
        org = Organization.objects.get(memberships__user__email=email)
        if activated:
            Organization.objects.filter(pk=org.pk).update(sms_activated=True, sms_sender_id="ACME")
        return t, org

    def test_price_is_calculated_on_server_with_tiers(self):
        t, _ = self.signup()
        q = gql(self.c, "{quoteCredits(smsQuantity:1500,emailQuantity:500){total sms{unitPrice subtotal} email{subtotal}}}")
        self.assertEqual(q["data"]["quoteCredits"]["sms"]["unitPrice"], 25.0)           # 1000+ tier
        self.assertEqual(q["data"]["quoteCredits"]["total"], 1500 * 25 + 500 * 5)
        o = gql(self.c, ORDER, {"s": 150}, t)["data"]["createCreditOrder"]["order"]
        self.assertEqual((o["total"], o["status"]), (4500.0, "pending_payment"))
        self.assertTrue(o["reference"].startswith("PK-"))

    def test_quantity_validation(self):
        t, _ = self.signup()
        for s, e in [(0, 0), (50, 0), (-5, 0), (0, 100), (2_000_000, 0)]:
            self.assertIn("errors", gql(self.c, ORDER, {"s": s, "e": e}, t), (s, e))
        CreditPrice.objects.filter(channel="email").delete()
        self.assertIn("errors", gql(self.c, ORDER, {"s": 0, "e": 600}, t))   # email not on sale

    def test_full_flow_pay_approve_and_send(self):
        t, org = self.signup()
        oid = gql(self.c, ORDER, {"s": 100, "e": 500}, t)["data"]["createCreditOrder"]["order"]["id"]
        self.assertIn("errors", gql(self.c, 'mutation($i:ID!){submitPayment(id:$i,paymentReference:"x"){order{id}}}', {"i": oid}, t))
        d = gql(self.c, 'mutation($i:ID!){submitPayment(id:$i,paymentReference:"QK12ABC9"){order{status}}}', {"i": oid}, t)
        self.assertEqual(d["data"]["submitPayment"]["order"]["status"], "payment_submitted")
        self.assertIn("errors", gql(self.c, REVIEW, {"i": oid, "a": "approve"}, t))      # customers cannot approve
        self.assertNotIn("errors", gql(self.c, REVIEW, {"i": oid, "a": "approve"}, self.staff))
        self.assertIn("errors", gql(self.c, REVIEW, {"i": oid, "a": "approve"}, self.staff))  # never credited twice
        acc = CreditAccount.objects.get(organization=org)
        self.assertEqual((acc.sms_balance, acc.email_balance), (100, 500))
        # plan quota (1 SMS) is used first, then purchased credits
        srcs = [gql(self.c, SEND, {"c": "sms", "r": "0712345678", "b": "x"}, t)["data"]["sendTest"]["message"]["billingSource"] for _ in range(2)]
        self.assertEqual(srcs, ["subscription", "credits"])
        e = gql(self.c, SEND, {"c": "email", "r": "b@y.com", "b": "x"}, t)["data"]["sendTest"]["message"]
        self.assertEqual(e["billingSource"], "credits")
        acc.refresh_from_db()
        self.assertEqual((acc.sms_balance, acc.email_balance), (99, 499))
        self.assertEqual(CreditEntry.objects.filter(organization=org, kind="debit").count(), 2)
        bal = gql(self.c, "{creditBalance{sms email}}", token=t)["data"]["creditBalance"]
        self.assertEqual(bal, {"sms": 99, "email": 499})

    def test_reject_needs_reason_and_adds_nothing(self):
        t, org = self.signup()
        oid = gql(self.c, ORDER, {"s": 100}, t)["data"]["createCreditOrder"]["order"]["id"]
        self.assertIn("errors", gql(self.c, REVIEW, {"i": oid, "a": "reject", "n": ""}, self.staff))
        self.assertNotIn("errors", gql(self.c, REVIEW, {"i": oid, "a": "reject", "n": "No payment received"}, self.staff))
        self.assertFalse(CreditAccount.objects.filter(organization=org, sms_balance__gt=0).exists())

    def test_cancel_and_open_order_limit(self):
        t, _ = self.signup()
        ids = [gql(self.c, ORDER, {"s": 100}, t)["data"]["createCreditOrder"]["order"]["id"] for _ in range(3)]
        self.assertIn("errors", gql(self.c, ORDER, {"s": 100}, t))
        self.assertNotIn("errors", gql(self.c, 'mutation($i:ID!){cancelCreditOrder(id:$i){ok}}', {"i": ids[0]}, t))
        self.assertNotIn("errors", gql(self.c, ORDER, {"s": 100}, t))

    def test_orders_are_tenant_scoped(self):
        t1, _ = self.signup("a@x.com")
        t2, _ = self.signup("b@y.com")
        oid = gql(self.c, ORDER, {"s": 100}, t1)["data"]["createCreditOrder"]["order"]["id"]
        self.assertEqual(gql(self.c, "{creditOrders{id}}", token=t2)["data"]["creditOrders"], [])
        self.assertIn("errors", gql(self.c, 'mutation($i:ID!){submitPayment(id:$i,paymentReference:"QK12ABC9"){order{id}}}', {"i": oid}, t2))
        self.assertIn("errors", gql(self.c, 'mutation($i:ID!){cancelCreditOrder(id:$i){ok}}', {"i": oid}, t2))

    def test_failed_send_refunds_purchased_credit(self):
        from unittest import mock
        from core.upstream import UpstreamError
        t, org = self.signup()
        Plan.objects.update(sms_quota=0)
        CreditAccount.objects.create(organization=org, sms_balance=5)
        with mock.patch("core.upstream.send_sms", side_effect=UpstreamError("down")):
            m = gql(self.c, SEND, {"c": "sms", "r": "0712345678", "b": "x"}, t)["data"]["sendTest"]["message"]
        self.assertEqual((m["status"], m["billingSource"]), ("failed", "credits"))
        self.assertEqual(CreditAccount.objects.get(organization=org).sms_balance, 5)

    def test_demo_mode_sms_still_uses_demo_even_with_purchased_credits(self):
        t, org = self.signup(activated=False)
        CreditAccount.objects.create(organization=org, sms_balance=50)
        m = gql(self.c, SEND, {"c": "sms", "r": "0712345678", "b": "x"}, t)["data"]["sendTest"]["message"]
        self.assertEqual(m["billingSource"], "demo")

    def test_payment_settings_admin_only_and_public_read(self):
        q = 'mutation{updatePaymentSettings(supportWhatsapp:"+255700000001",supportEmail:"help@promokote.co.tz",paymentInstructions:"Lipa namba 123"){settings{supportWhatsapp}}}'
        t, _ = self.signup()
        self.assertIn("errors", gql(self.c, q, token=t))
        self.assertNotIn("errors", gql(self.c, q, token=self.staff))
        d = gql(self.c, "{paymentSettings{supportWhatsapp supportEmail paymentInstructions}}")["data"]["paymentSettings"]
        self.assertEqual(d["supportWhatsapp"], "+255700000001")
        self.assertIn("errors", gql(self.c, 'mutation{updatePaymentSettings(supportEmail:"nope"){settings{supportEmail}}}', token=self.staff))

    def test_admin_sets_price_tiers(self):
        q = 'mutation($t:[PriceTierInput!]!){setCreditPrices(channel:"sms",tiers:$t){prices{minQuantity unitPrice}}}'
        d = gql(self.c, q, {"t": [{"minQuantity": 50, "unitPrice": 28}, {"minQuantity": 5000, "unitPrice": 18}]}, self.staff)
        self.assertEqual(len(d["data"]["setCreditPrices"]["prices"]), 2)
        self.assertIn("errors", gql(self.c, q, {"t": [{"minQuantity": 0, "unitPrice": 28}]}, self.staff))
        t, _ = self.signup()
        self.assertIn("errors", gql(self.c, q, {"t": []}, t))

    def test_team_is_emailed_about_new_orders(self):
        from unittest import mock
        PaymentSettings.objects.update_or_create(pk=1, defaults={"support_email": "team@promokote.co.tz"})
        t, _ = self.signup()
        with mock.patch("billing.orders_schema.send_system_email") as m, self.captureOnCommitCallbacks(execute=True):
            gql(self.c, ORDER, {"s": 100}, t)
        self.assertEqual(m.call_args.args[0], "team@promokote.co.tz")
