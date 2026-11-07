import json
from django.test import TestCase, Client
from accounts.models import User
from billing.models import Plan
from messaging.services import normalize_phone, sms_info


def gql(client, query, variables=None, token=None):
    h = {"HTTP_AUTHORIZATION": f"Bearer {token}"} if token else {}
    r = client.post("/graphql/", data=json.dumps({"query": query, "variables": variables or {}}),
                    content_type="application/json", **h)
    return r.json()


REGISTER = """mutation($e:String!,$p:String!){register(email:$e,password:$p,fullName:"A B",organizationName:"Acme"){token user{email organization{role}}}}"""
CREATE_KEY = """mutation($s:String!){createApiKey(name:"k",service:$s){secret apiKey{id key}}}"""


class Helpers:
    def setUp(self):
        self.c = Client()
        Plan.objects.create(name="Free", price=0, sms_quota=3, email_quota=2, rate_limit_per_minute=100, max_api_keys=3, is_default=True)

    def register(self, email="a@x.com"):
        d = gql(self.c, REGISTER, {"e": email, "p": "Str0ng-pass-1"})
        self.assertNotIn("errors", d, d)
        return d["data"]["register"]["token"]

    def key(self, token, service="all"):
        d = gql(self.c, CREATE_KEY, {"s": service}, token)
        self.assertNotIn("errors", d, d)
        return d["data"]["createApiKey"]["apiKey"]["key"], d["data"]["createApiKey"]["secret"]

    def api(self, path, key, secret, body=None, **extra):
        h = {"HTTP_X_API_KEY": key, "HTTP_X_API_SECRET": secret, **extra}
        return self.c.post(f"/api/v1/{path}/", data=json.dumps(body or {}), content_type="application/json", **h)


class FlowTests(Helpers, TestCase):
    def test_phone_and_segments(self):
        self.assertEqual(normalize_phone("0712 345 678"), "+255712345678")
        self.assertEqual(sms_info("a" * 161)[2], 2)
        self.assertEqual(sms_info("habari 😀")[0], "Unicode")

    def test_register_login_and_me(self):
        t = self.register()
        d = gql(self.c, "{me{email organization{role}}}", token=t)
        self.assertEqual(d["data"]["me"]["organization"]["role"], "owner")
        d = gql(self.c, 'mutation{login(email:"a@x.com",password:"Str0ng-pass-1"){token}}')
        self.assertTrue(d["data"]["login"]["token"])
        self.assertIn("errors", gql(self.c, 'mutation{login(email:"a@x.com",password:"bad"){token}}'))

    def test_rest_send_sms_email_quota_idempotency(self):
        k, s = self.key(self.register())
        r = self.api("send-sms", k, s, {"to": "0712345678", "text": "Hi"})
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()["messages"][0]["status"], "sent")
        self.assertEqual(self.api("send-email", k, s, {"recipient": "b@y.com", "subject": "S", "html_body": "<p>x</p>"}).status_code, 200)
        # idempotency: same key does not double send / double charge
        a = self.api("send-sms", k, s, {"to": "0712345678", "text": "Hi"}, HTTP_IDEMPOTENCY_KEY="abc").json()
        b = self.api("send-sms", k, s, {"to": "0712345678", "text": "Hi"}, HTTP_IDEMPOTENCY_KEY="abc").json()
        self.assertEqual(a["messages"][0]["id"], b["messages"][0]["id"])
        # quota is 3 sms: used 2 so far -> next fits, then 402
        self.assertEqual(self.api("send-sms", k, s, {"to": "0712345678", "text": "x"}).status_code, 200)
        self.assertEqual(self.api("send-sms", k, s, {"to": "0712345678", "text": "x"}).status_code, 402)

    def test_auth_scope_and_validation(self):
        t = self.register()
        k, s = self.key(t, "sms")
        self.assertEqual(self.api("send-sms", k, "wrong", {"to": "0712345678", "text": "x"}).status_code, 401)
        self.assertEqual(self.api("send-email", k, s, {"recipient": "b@y.com", "subject": "s", "html_body": "x"}).status_code, 403)
        self.assertEqual(self.api("send-sms", k, s, {"to": "123", "text": "x"}).status_code, 400)
        self.assertEqual(self.c.post("/api/v1/send-sms/", data="{}", content_type="application/json").status_code, 401)

    def test_revoked_key_rejected(self):
        t = self.register()
        k, s = self.key(t)
        kid = gql(self.c, "{apiKeys{id key}}", token=t)["data"]["apiKeys"][0]["id"]
        gql(self.c, "mutation($i:ID!){revokeApiKey(id:$i){ok}}", {"i": kid}, t)
        self.assertEqual(self.api("send-sms", k, s, {"to": "0712345678", "text": "x"}).status_code, 401)

    def test_optout_blocks(self):
        t = self.register()
        k, s = self.key(t)
        gql(self.c, 'mutation{addOptOut(channel:"sms",address:"0712345678"){ok}}', token=t)
        m = self.api("send-sms", k, s, {"to": "+255712345678", "text": "x"}).json()["messages"][0]
        self.assertEqual(m["status"], "blocked")

    def test_tenant_isolation(self):
        t1, t2 = self.register("a@x.com"), self.register("b@x.com")
        k, s = self.key(t1)
        self.api("send-sms", k, s, {"to": "0712345678", "text": "x"})
        self.assertEqual(len(gql(self.c, "{messages{id}}", token=t1)["data"]["messages"]), 1)
        self.assertEqual(len(gql(self.c, "{messages{id}}", token=t2)["data"]["messages"]), 0)
        self.assertEqual(gql(self.c, "{apiKeys{id}}", token=t2)["data"]["apiKeys"], [])

    def test_campaign_and_admin_plans(self):
        t = self.register()
        lid = gql(self.c, 'mutation{createContactList(name:"L"){list{id}}}', token=t)["data"]["createContactList"]["list"]["id"]
        r = gql(self.c, 'mutation($l:ID!){addContacts(listId:$l,raw:"John,0711111111\\nbad,12\\n0722222222"){added invalid}}', {"l": lid}, t)
        self.assertEqual(r["data"]["addContacts"]["added"], 2)
        c = gql(self.c, 'mutation($l:ID!){createCampaign(name:"C",channel:"sms",body:"Hi {{name}}",listIds:[$l],sendNow:true){campaign{id total}}}', {"l": lid}, t)
        self.assertNotIn("errors", c, c)
        self.assertEqual(c["data"]["createCampaign"]["campaign"]["total"], 2)
        from messaging.services import dispatch_campaign
        from messaging.models import Campaign, Message
        cid = c["data"]["createCampaign"]["campaign"]["id"]
        dispatch_campaign(cid)
        self.assertEqual(Message.objects.filter(campaign_id=cid, status="sent").count(), 2)
        self.assertEqual(Campaign.objects.get(pk=cid).status, "completed")
        # non-staff cannot use admin ops
        self.assertIn("errors", gql(self.c, "{adminPlans{id}}", token=t))
        staff = User.objects.create_superuser("root@x.com", "Str0ng-pass-1")
        from accounts.tokens import make_jwt
        a = gql(self.c, "{adminPlans{name}}", token=make_jwt(staff))
        self.assertNotIn("errors", a, a)

    def test_paid_plan_needs_admin_activation(self):
        t = self.register()
        paid = Plan.objects.create(name="Pro", price=1000, sms_quota=10, email_quota=10)
        d = gql(self.c, 'mutation($p:ID!){subscribe(planId:$p){subscription{status}}}', {"p": str(paid.id)}, t)
        self.assertEqual(d["data"]["subscribe"]["subscription"]["status"], "pending")


from unittest import mock
from django.test import override_settings


@override_settings(UPSTREAM_FAKE=False, UPSTREAM_API_KEY="eak_test", UPSTREAM_API_SECRET="sec_test",
                   UPSTREAM_BASE_URL="https://emailbackend.tarxemo.com/api/v1")
class UpstreamTests(Helpers, TestCase):
    """Checks the exact calls made to the upstream platform (HTTP is mocked)."""

    def _resp(self, status=200, body=None):
        r = mock.Mock(); r.status_code = status; r.json.return_value = body if body is not None else {"id": "up-1"}; r.text = str(body)
        return r

    def test_upstream_payload_and_headers(self):
        k, s = self.key(self.register())
        with mock.patch("core.upstream.requests.post", return_value=self._resp()) as p:
            self.api("send-sms", k, s, {"to": "0712345678", "text": "Hi"})
            self.api("send-email", k, s, {"recipient": "b@y.com", "subject": "S", "html_body": "<p>x</p>"})
        sms, email = [c for c in p.call_args_list if "send-sms" in c.args[0]][0], [c for c in p.call_args_list if "send-email" in c.args[0]][0]
        self.assertEqual(sms.args[0], "https://emailbackend.tarxemo.com/api/v1/send-sms/")
        self.assertEqual(sms.kwargs["json"], {"to": "+255712345678", "text": "Hi"})
        self.assertEqual(sms.kwargs["headers"]["X-API-KEY"], "eak_test")
        self.assertEqual(sms.kwargs["headers"]["X-API-SECRET"], "sec_test")
        self.assertEqual(email.kwargs["json"], {"recipient": "b@y.com", "subject": "S", "html_body": "<p>x</p>"})

    def test_upstream_failure_marks_failed_and_refunds(self):
        t = self.register()
        k, s = self.key(t)
        with mock.patch("core.upstream.requests.post", return_value=self._resp(500, {"detail": "boom"})):
            r = self.api("send-sms", k, s, {"to": "0712345678", "text": "Hi"}).json()
        self.assertEqual(r["messages"][0]["status"], "failed")
        usage = self.c.get("/api/v1/usage/", HTTP_X_API_KEY=k, HTTP_X_API_SECRET=s).json()
        self.assertEqual(usage["sms"]["used"], 0)   # credit refunded
