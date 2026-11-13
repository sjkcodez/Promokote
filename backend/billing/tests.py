import json
import threading
from django.db import connection
from django.test import Client, TestCase, TransactionTestCase, override_settings
from accounts.models import Organization, User
from accounts.tokens import make_jwt
from billing import demo
from billing.models import DemoAllowance, DemoClaim, DemoCreditEntry, Plan, SenderIdRequest
from messaging.models import Message
from messaging.tests import CREATE_KEY, gql

REGISTER = """mutation($e:String!){register(email:$e,password:"Str0ng-pass-1",fullName:"A B",organizationName:"Acme"){token}}"""
SEND = """mutation($r:String!,$b:String!){sendTest(channel:"sms",recipient:$r,body:$b){message{status billingSource senderId}}}"""


class DemoBase:
    def setUp(self):
        self.c = Client()
        Plan.objects.create(name="Free", price=0, sms_quota=100, email_quota=5, is_default=True)

    def signup(self, email="owner@x.com", verify=True, **headers):
        d = gql(self.c, REGISTER, {"e": email}) if not headers else self._raw(REGISTER, {"e": email}, headers)
        self.assertNotIn("errors", d, d)
        if verify:
            User.objects.filter(email=email).update(email_verified=True)
        return d["data"]["register"]["token"], Organization.objects.get(memberships__user__email=email)

    def _raw(self, q, v, headers):
        return self.c.post("/graphql/", data=json.dumps({"query": q, "variables": v}), content_type="application/json", **headers).json()

    def send(self, token, to="0712345678", body="Habari"):
        return gql(self.c, SEND, {"r": to, "b": body}, token)


class DemoCreditTests(DemoBase, TestCase):
    def test_new_org_gets_ten_demo_credits_and_ledger_grant(self):
        _, org = self.signup()
        a = DemoAllowance.objects.get(organization=org)
        self.assertEqual((a.granted, a.used), (10, 0))
        self.assertFalse(org.sms_activated)
        self.assertEqual(DemoCreditEntry.objects.get(organization=org).kind, "grant")

    def test_demo_send_uses_generic_sender_and_not_subscription(self):
        t, org = self.signup()
        d = self.send(t)
        self.assertNotIn("errors", d, d)
        m = d["data"]["sendTest"]["message"]
        self.assertEqual((m["status"], m["billingSource"], m["senderId"]), ("sent", "demo", "PROMOKOTE"))
        self.assertEqual(DemoAllowance.objects.get(organization=org).used, 1)
        self.assertEqual(org.subscriptions.get(status="active").sms_used, 0)   # paid quota untouched
        self.assertEqual(DemoCreditEntry.objects.filter(organization=org, kind="debit").count(), 1)

    def test_demo_limit_enforced_on_backend(self):
        t, org = self.signup()
        for i in range(10):
            self.assertNotIn("errors", self.send(t, to=f"07123456{i:02d}"))
        d = self.send(t, to="0799999999")
        self.assertIn("errors", d)
        self.assertEqual(DemoAllowance.objects.get(organization=org).used, 10)
        # the REST API is held to the same limit
        k = gql(self.c, CREATE_KEY, {"s": "sms"}, t)["data"]["createApiKey"]
        r = self.c.post("/api/v1/send-sms/", data=json.dumps({"to": "0788888888", "text": "x"}), content_type="application/json",
                        HTTP_X_API_KEY=k["apiKey"]["key"], HTTP_X_API_SECRET=k["secret"])
        self.assertEqual(r.status_code, 402)

    def test_multi_segment_counts_each_segment(self):
        t, org = self.signup()
        self.assertNotIn("errors", self.send(t, body="a" * 161))   # 2 segments
        self.assertEqual(DemoAllowance.objects.get(organization=org).used, 2)

    def test_unverified_email_cannot_use_demo(self):
        t, org = self.signup(verify=False)
        d = self.send(t)
        self.assertIn("errors", d)
        self.assertEqual(DemoAllowance.objects.get(organization=org).used, 0)

    def test_errors_are_kiswahili_by_default_and_english_on_request(self):
        t, _ = self.signup(verify=False)
        sw = gql(self.c, SEND, {"r": "0712345678", "b": "x"}, t)["errors"][0]["message"]
        self.assertIn("Thibitisha barua pepe", sw)
        en = self._raw(SEND, {"r": "0712345678", "b": "x"}, {"HTTP_AUTHORIZATION": f"Bearer {t}", "HTTP_ACCEPT_LANGUAGE": "en"})
        self.assertIn("Verify your email", en["errors"][0]["message"])

    def test_alias_and_reregistration_do_not_get_new_credits(self):
        self.signup("asha.m@gmail.com")
        _, org2 = self.signup("asham+promo@googlemail.com")
        a = DemoAllowance.objects.get(organization=org2)
        self.assertEqual((a.granted, a.ineligible_reason), (0, "already_claimed"))
        # deleting the account and registering again does not reset the claim
        User.objects.filter(email="asha.m@gmail.com").delete()
        _, org3 = self.signup("asha.m@gmail.com")
        self.assertEqual(DemoAllowance.objects.get(organization=org3).granted, 0)

    @override_settings(DEMO_MAX_CLAIMS_PER_IP_PER_DAY=2)
    def test_ip_cap(self):
        for i in range(3):
            self.signup(f"u{i}@x.com")
        granted = list(DemoAllowance.objects.order_by("created_at").values_list("granted", flat=True))
        self.assertEqual(granted, [10, 10, 0])

    @override_settings(DEMO_MAX_PER_RECIPIENT_PER_DAY=2)
    def test_recipient_cap_across_accounts(self):
        t1, _ = self.signup("a@x.com")
        t2, _ = self.signup("b@y.com")
        self.assertNotIn("errors", self.send(t1))
        self.assertNotIn("errors", self.send(t2))
        self.assertIn("errors", self.send(t1))

    def test_failed_upstream_refunds_demo_credit(self):
        from unittest import mock
        from core.upstream import UpstreamError
        t, org = self.signup()
        with mock.patch("core.upstream.send_sms", side_effect=UpstreamError("down")):
            m = self.send(t)["data"]["sendTest"]["message"]
        self.assertEqual(m["status"], "failed")
        self.assertEqual(DemoAllowance.objects.get(organization=org).used, 0)
        kinds = sorted(DemoCreditEntry.objects.filter(organization=org).values_list("kind", flat=True))
        self.assertEqual(kinds, ["debit", "grant", "refund"])

    def test_demo_campaign_checks_balance_up_front(self):
        t, org = self.signup()
        lid = gql(self.c, 'mutation{createContactList(name:"L"){list{id}}}', token=t)["data"]["createContactList"]["list"]["id"]
        raw = "\\n".join(f"07111111{i:02d}" for i in range(11))
        gql(self.c, f'mutation($l:ID!){{addContacts(listId:$l,raw:"{raw}"){{added}}}}', {"l": lid}, t)
        d = gql(self.c, 'mutation($l:ID!){createCampaign(name:"C",channel:"sms",body:"Hi",listIds:[$l],sendNow:true){campaign{id}}}', {"l": lid}, t)
        self.assertIn("errors", d)
        self.assertEqual(DemoAllowance.objects.get(organization=org).used, 0)

    def test_demo_credits_query_is_tenant_scoped(self):
        t1, _ = self.signup("a@x.com")
        t2, _ = self.signup("b@y.com")
        self.send(t1)
        q = "{demoCredits{granted used remaining active history{kind units}}}"
        self.assertEqual(gql(self.c, q, token=t1)["data"]["demoCredits"]["used"], 1)
        self.assertEqual(gql(self.c, q, token=t2)["data"]["demoCredits"]["used"], 0)


class SenderIdWorkflowTests(DemoBase, TestCase):
    REQ = """mutation($s:String!){requestSenderId(senderId:$s,businessName:"Acme Ltd",registrationNumber:"123-456",
             contactPhone:"0712345678",useCase:"Order updates",sampleMessage:"Your order is ready"){request{id status}}}"""

    def test_full_activation_flow(self):
        t, org = self.signup()
        d = gql(self.c, self.REQ, {"s": "ACME"}, t)
        self.assertNotIn("errors", d, d)
        rid = d["data"]["requestSenderId"]["request"]["id"]
        self.assertIn("errors", gql(self.c, self.REQ, {"s": "ACME2"}, t))     # one open request at a time
        staff = User.objects.create_superuser("root@x.com", "Str0ng-pass-1")
        st = make_jwt(staff)
        self.assertIn("errors", gql(self.c, 'mutation($i:ID!){reviewSenderIdRequest(id:$i,action:"approve"){request{id}}}', {"i": rid}, t))
        for action in ("confirm_payment", "approve"):
            r = gql(self.c, 'mutation($i:ID!,$a:String!){reviewSenderIdRequest(id:$i,action:$a){request{status}}}', {"i": rid, "a": action}, st)
            self.assertNotIn("errors", r, r)
        org.refresh_from_db()
        self.assertTrue(org.sms_activated)
        self.assertEqual(org.sms_sender_id, "ACME")
        # now SMS are charged to the plan and sent with the approved Sender ID
        m = self.send(t)["data"]["sendTest"]["message"]
        self.assertEqual((m["billingSource"], m["senderId"]), ("subscription", "ACME"))
        self.assertEqual(org.subscriptions.get(status="active").sms_used, 1)

    def test_sender_id_validation(self):
        t, _ = self.signup()
        for bad in ("AB", "123456", "TOO-LONG-NAME", "PROMOKOTE"):
            self.assertIn("errors", gql(self.c, self.REQ, {"s": bad}, t), bad)

    def test_sender_id_unique_across_orgs(self):
        Organization.objects.create(name="Other", sms_activated=True, sms_sender_id="ACME")
        t, _ = self.signup()
        self.assertIn("errors", gql(self.c, self.REQ, {"s": "acme"}, t))

    def test_reject_needs_reason_and_allows_resubmission(self):
        t, _ = self.signup()
        rid = gql(self.c, self.REQ, {"s": "ACME"}, t)["data"]["requestSenderId"]["request"]["id"]
        st = make_jwt(User.objects.create_superuser("root@x.com", "Str0ng-pass-1"))
        q = 'mutation($i:ID!,$n:String){reviewSenderIdRequest(id:$i,action:"reject",note:$n){request{status}}}'
        self.assertIn("errors", gql(self.c, q, {"i": rid, "n": ""}, st))
        self.assertNotIn("errors", gql(self.c, q, {"i": rid, "n": "Name does not match BRELA"}, st))
        self.assertNotIn("errors", gql(self.c, self.REQ, {"s": "ACMELTD"}, t))

    def test_language_preference_persists(self):
        t, _ = self.signup()
        self.assertEqual(gql(self.c, "{me{language}}", token=t)["data"]["me"]["language"], "sw")
        gql(self.c, 'mutation{setLanguage(language:"en"){user{language}}}', token=t)
        self.assertEqual(gql(self.c, "{me{language}}", token=t)["data"]["me"]["language"], "en")
        self.assertIn("errors", gql(self.c, 'mutation{setLanguage(language:"fr"){user{language}}}', token=t))

    def test_public_activation_config(self):
        d = gql(self.c, "{smsActivationConfig{senderIdFee currency processingDays demoCredits demoSenderName}}")
        self.assertEqual(d["data"]["smsActivationConfig"]["demoCredits"], 10)


class DemoConcurrencyTests(DemoBase, TransactionTestCase):
    """Concurrent deductions never exceed the allowance (conditional UPDATE + DB check constraint)."""

    def test_parallel_consumption(self):
        _, org = self.signup()
        DemoAllowance.objects.filter(organization=org).update(used=7)   # 3 left
        results, lock = [], threading.Lock()

        def worker(i):
            from messaging.services import SendError, submit_message
            try:
                submit_message(org, "sms", f"07222222{i:02d}", "x", source="console", dispatch=False)
                ok = True
            except Exception:   # SendError when exhausted; SQLite may also raise "database is locked"
                ok = False
            finally:
                connection.close()
            with lock:
                results.append(ok)

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(8)]
        [th.start() for th in threads]
        [th.join() for th in threads]
        a = DemoAllowance.objects.get(organization=org)
        sent = Message.objects.filter(organization=org, billing_source="demo").count()
        debits = DemoCreditEntry.objects.filter(organization=org, kind="debit").count()
        self.assertLessEqual(a.used, a.granted)                       # never overdrawn
        self.assertEqual((sent, debits, a.used - 7), (results.count(True),) * 3)   # balance, messages and ledger agree
        if connection.vendor == "postgresql":                          # SQLite serialises writers instead
            self.assertEqual(results.count(True), 3)
