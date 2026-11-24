from django.test import Client, TestCase
from accounts.models import Membership, Organization, User
from accounts.tokens import make_jwt
from billing.models import Plan
from messaging.tests import gql

REGISTER = """mutation($e:String!){register(email:$e,password:"Str0ng-pass-1",fullName:"Owner",organizationName:"Acme"){token}}"""
TEAM = "{team{id email role status isYou canManage}}"


class UserManagementTests(TestCase):
    def setUp(self):
        self.c = Client()
        Plan.objects.create(name="Free", price=0, sms_quota=1, email_quota=1, is_default=True)
        self.owner_t = gql(self.c, REGISTER, {"e": "owner@x.com"})["data"]["register"]["token"]
        self.org = Organization.objects.get(memberships__user__email="owner@x.com")

    def member(self, email, role, password=True):
        u = User.objects.create_user(email, "Str0ng-pass-1" if password else None)
        if not password:
            u.set_unusable_password(); u.save()
        Membership.objects.create(user=u, organization=self.org, role=role)
        return u, make_jwt(u)

    def test_team_list_and_hierarchy(self):
        admin, admin_t = self.member("adm@x.com", "admin")
        admin2, _ = self.member("adm2@x.com", "admin")
        mk, _ = self.member("mk@x.com", "marketer")
        rows = {r["email"]: r for r in gql(self.c, TEAM, token=admin_t)["data"]["team"]}
        self.assertEqual((rows["owner@x.com"]["canManage"], rows["adm2@x.com"]["canManage"], rows["mk@x.com"]["canManage"]), (False, False, True))
        self.assertTrue(rows["adm@x.com"]["isYou"])
        q = 'mutation($u:ID!,$r:String!){updateMemberRole(userId:$u,role:$r){member{role}}}'
        self.assertNotIn("errors", gql(self.c, q, {"u": str(mk.id), "r": "developer"}, admin_t))
        self.assertIn("errors", gql(self.c, q, {"u": str(mk.id), "r": "admin"}, admin_t))         # admin cannot create admins
        self.assertIn("errors", gql(self.c, q, {"u": str(admin2.id), "r": "viewer"}, admin_t))    # nor manage other admins
        owner = User.objects.get(email="owner@x.com")
        self.assertIn("errors", gql(self.c, q, {"u": str(owner.id), "r": "viewer"}, admin_t))     # nor the owner
        self.assertIn("errors", gql(self.c, q, {"u": str(admin.id), "r": "viewer"}, admin_t))     # nor themselves
        self.assertIn("errors", gql(self.c, q, {"u": str(mk.id), "r": "owner"}, self.owner_t))    # owner only via transfer
        self.assertNotIn("errors", gql(self.c, q, {"u": str(mk.id), "r": "admin"}, self.owner_t))

    def test_viewer_cannot_manage_team(self):
        mk, _ = self.member("mk@x.com", "marketer")
        _, viewer_t = self.member("v@x.com", "viewer")
        self.assertIn("errors", gql(self.c, 'mutation($u:ID!){removeMember(userId:$u){ok}}', {"u": str(mk.id)}, viewer_t))

    def test_remove_member_ends_access_immediately(self):
        mk, mk_t = self.member("mk@x.com", "marketer")
        self.assertIsNotNone(gql(self.c, "{me{email}}", token=mk_t)["data"]["me"])
        self.assertNotIn("errors", gql(self.c, 'mutation($u:ID!){removeMember(userId:$u){ok}}', {"u": str(mk.id)}, self.owner_t))
        self.assertIsNone(gql(self.c, "{me{email}}", token=mk_t)["data"]["me"])

    def test_cross_org_isolation(self):
        other_t = gql(self.c, REGISTER, {"e": "other@y.com"})["data"]["register"]["token"]
        mk, _ = self.member("mk@x.com", "marketer")
        self.assertIn("errors", gql(self.c, 'mutation($u:ID!){removeMember(userId:$u){ok}}', {"u": str(mk.id)}, other_t))
        self.assertTrue(Membership.objects.filter(user=mk).exists())

    def test_resend_invite_only_for_pending(self):
        inv, _ = self.member("inv@x.com", "viewer", password=False)
        act, _ = self.member("act@x.com", "viewer")
        q = 'mutation($u:ID!){resendInvite(userId:$u){ok}}'
        self.assertNotIn("errors", gql(self.c, q, {"u": str(inv.id)}, self.owner_t))
        self.assertIn("errors", gql(self.c, q, {"u": str(act.id)}, self.owner_t))
        rows = {r["email"]: r["status"] for r in gql(self.c, TEAM, token=self.owner_t)["data"]["team"]}
        self.assertEqual((rows["inv@x.com"], rows["act@x.com"]), ("invited", "active"))

    def test_transfer_ownership(self):
        adm, adm_t = self.member("adm@x.com", "admin")
        q = 'mutation($u:ID!,$p:String!){transferOwnership(userId:$u,password:$p){ok}}'
        self.assertIn("errors", gql(self.c, q, {"u": str(adm.id), "p": "wrong"}, self.owner_t))
        self.assertIn("errors", gql(self.c, q, {"u": str(adm.id), "p": "Str0ng-pass-1"}, adm_t))   # not the owner
        User.objects.filter(pk=adm.pk).update(last_login="2026-11-01T10:00:00Z")
        self.assertNotIn("errors", gql(self.c, q, {"u": str(adm.id), "p": "Str0ng-pass-1"}, self.owner_t))
        roles = dict(Membership.objects.filter(organization=self.org).values_list("user__email", "role"))
        self.assertEqual((roles["owner@x.com"], roles["adm@x.com"]), ("admin", "owner"))
        self.assertEqual(Membership.objects.filter(organization=self.org, role="owner").count(), 1)

    def test_change_password_revokes_other_sessions(self):
        other_device = self.owner_t
        q = 'mutation($c:String!,$n:String!){changePassword(currentPassword:$c,newPassword:$n){token}}'
        self.assertIn("errors", gql(self.c, q, {"c": "bad", "n": "An0ther-pass-2"}, self.owner_t))
        new = gql(self.c, q, {"c": "Str0ng-pass-1", "n": "An0ther-pass-2"}, self.owner_t)["data"]["changePassword"]["token"]
        self.assertIsNone(gql(self.c, "{me{email}}", token=other_device)["data"]["me"])
        self.assertEqual(gql(self.c, "{me{email}}", token=new)["data"]["me"]["email"], "owner@x.com")
        self.assertTrue(gql(self.c, 'mutation{login(email:"owner@x.com",password:"An0ther-pass-2"){token}}')["data"]["login"]["token"])

    def test_sign_out_everywhere_and_profile(self):
        old = self.owner_t
        new = gql(self.c, "mutation{signOutEverywhere{token}}", token=old)["data"]["signOutEverywhere"]["token"]
        self.assertIsNone(gql(self.c, "{me{email}}", token=old)["data"]["me"])
        d = gql(self.c, 'mutation{updateProfile(fullName:"Asha M",phone:"0712 345 678"){user{fullName phone}}}', token=new)
        self.assertEqual(d["data"]["updateProfile"]["user"], {"fullName": "Asha M", "phone": "+255712345678"})
        self.assertIn("errors", gql(self.c, 'mutation{updateProfile(fullName:"A",phone:"12"){user{id}}}', token=new))

    def test_change_email_requires_password_and_reverifies(self):
        self.member("taken@x.com", "viewer")
        q = 'mutation($e:String!,$p:String!){changeEmail(newEmail:$e,password:$p){user{email emailVerified}}}'
        self.assertIn("errors", gql(self.c, q, {"e": "new@x.com", "p": "bad"}, self.owner_t))
        self.assertIn("errors", gql(self.c, q, {"e": "taken@x.com", "p": "Str0ng-pass-1"}, self.owner_t))
        d = gql(self.c, q, {"e": "New@X.com", "p": "Str0ng-pass-1"}, self.owner_t)
        self.assertEqual(d["data"]["changeEmail"]["user"], {"email": "new@x.com", "emailVerified": False})

    def test_platform_admin_user_controls(self):
        staff = User.objects.create_user("root@p.com", "Str0ng-pass-1", is_staff=True)
        st = make_jwt(staff)
        mk, mk_t = self.member("mk@x.com", "marketer")
        self.assertIn("errors", gql(self.c, "{adminUsers{id}}", token=self.owner_t))
        found = gql(self.c, '{adminUsers(search:"Acme"){email organizationName}}', token=st)["data"]["adminUsers"]
        self.assertEqual({u["email"] for u in found}, {"owner@x.com", "mk@x.com"})
        q = 'mutation($i:ID!,$a:Boolean,$s:Boolean){adminUpdateUser(id:$i,isActive:$a,isStaff:$s){user{isActive status}}}'
        d = gql(self.c, q, {"i": str(mk.id), "a": False}, st)
        self.assertEqual(d["data"]["adminUpdateUser"]["user"], {"isActive": False, "status": "deactivated"})
        self.assertIsNone(gql(self.c, "{me{email}}", token=mk_t)["data"]["me"])                         # session killed
        self.assertIn("errors", gql(self.c, 'mutation{login(email:"mk@x.com",password:"Str0ng-pass-1"){token}}'))
        self.assertIn("errors", gql(self.c, q, {"i": str(staff.id), "a": False}, st))                   # not yourself
        sup = User.objects.create_superuser("sup@p.com", "Str0ng-pass-1")
        self.assertIn("errors", gql(self.c, q, {"i": str(sup.id), "s": False}, st))                     # not a superuser
        self.assertNotIn("errors", gql(self.c, 'mutation($i:ID!){adminSendPasswordReset(id:$i){ok}}', {"i": str(User.objects.get(email="owner@x.com").id)}, st))

    def test_admin_cannot_invite_admin(self):
        _, adm_t = self.member("adm@x.com", "admin")
        q = 'mutation($r:String!){inviteMember(email:"n@x.com",role:$r){ok}}'
        self.assertIn("errors", gql(self.c, q, {"r": "admin"}, adm_t))
        self.assertNotIn("errors", gql(self.c, q, {"r": "marketer"}, adm_t))

    def test_old_tokens_without_version_still_work(self):
        import jwt
        from datetime import datetime, timedelta, timezone
        from django.conf import settings
        u = User.objects.get(email="owner@x.com")
        now = datetime.now(timezone.utc)
        legacy = jwt.encode({"sub": str(u.id), "iat": now, "exp": now + timedelta(days=1)}, settings.SECRET_KEY, algorithm="HS256")
        self.assertEqual(gql(self.c, "{me{email}}", token=legacy)["data"]["me"]["email"], "owner@x.com")
