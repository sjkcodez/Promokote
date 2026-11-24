"""
Lightweight translation for messages the web console shows to people (GraphQL errors, system emails).

Messages are written in English in the code (so logs, tests and the developer REST API stay English) and translated
to Kiswahili at the edge: `I18nGraphQLView` translates every GraphQL error into the request's language, and system
emails are rendered in the recipient's saved language. Add new user-facing errors to EXACT or PATTERNS below.
"""
import html
import re
from contextvars import ContextVar
from django.conf import settings

current_language = ContextVar("current_language", default=None)


def normalize(lang):
    lang = (lang or "").strip().lower()[:2]
    return lang if lang in settings.APP_LANGUAGES else None


def language_for(request):
    """`Accept-Language` sent by the console wins, then the signed-in user's saved preference, then the default."""
    header = request.META.get("HTTP_ACCEPT_LANGUAGE", "") if request is not None else ""
    lang = normalize(header.split(",")[0].split(";")[0]) if header else None
    user = getattr(request, "user", None)
    if not lang and user is not None and getattr(user, "is_authenticated", False):
        lang = normalize(getattr(user, "language", ""))
    return lang or settings.APP_DEFAULT_LANGUAGE


EXACT = {
    "API key not found.": "Ufunguo wa API haukupatikana.",
    "An account with this email already exists.": "Tayari kuna akaunti yenye barua pepe hii.",
    "Channel must be sms or email.": "Chagua SMS au barua pepe.",
    "Choose Admin, Marketer, Developer or Viewer.": "Chagua Msimamizi, Mtangazaji, Msanidi au Mtazamaji.",
    "Choose at least one contact list.": "Chagua angalau orodha moja ya anwani.",
    "Email campaigns need a subject.": "Kampeni za barua pepe zinahitaji kichwa cha habari.",
    "Email subject and body are required.": "Kichwa cha habari na maudhui ya barua pepe vinahitajika.",
    "Enter a valid phone number or email address.": "Weka namba ya simu au barua pepe sahihi.",
    "Give the key a name so you can recognise it later.": "Upe ufunguo jina ili uweze kuutambua baadaye.",
    "Incorrect email or password.": "Barua pepe au nenosiri si sahihi.",
    "List name is required.": "Jina la orodha linahitajika.",
    "List not found.": "Orodha haikupatikana.",
    "Message text is required.": "Andika ujumbe.",
    "No active subscription. Choose a plan to start sending.": "Huna kifurushi kinachotumika. Chagua kifurushi ili uanze kutuma.",
    "Organisation name is required.": "Jina la biashara linahitajika.",
    "Organisation not found.": "Biashara haikupatikana.",
    "Organisation or plan not found.": "Biashara au kifurushi hakikupatikana.",
    "Plan not found.": "Kifurushi hakikupatikana.",
    "Platform admin access required.": "Unahitaji ruhusa ya msimamizi wa mfumo.",
    "Please sign in to continue.": "Tafadhali ingia ili uendelee.",
    "Service must be sms, email or all.": "Huduma lazima iwe SMS, barua pepe au zote.",
    "That person already belongs to another organisation.": "Mtu huyo tayari yuko kwenye biashara nyingine.",
    "That plan is not available.": "Kifurushi hicho hakipatikani.",
    "The selected lists have no contacts with a valid phone number.": "Orodha ulizochagua hazina anwani zenye namba ya simu sahihi.",
    "The selected lists have no contacts with a valid email address.": "Orodha ulizochagua hazina anwani zenye barua pepe sahihi.",
    "This campaign cannot be cancelled.": "Kampeni hii haiwezi kusitishwa.",
    "This organisation is suspended. Contact support.": "Biashara hii imesimamishwa. Wasiliana na huduma kwa wateja.",
    "This organisation is suspended.": "Biashara hii imesimamishwa.",
    "This reset link is invalid or has expired.": "Kiungo hiki cha kubadili nenosiri si sahihi au muda wake umeisha.",
    "This verification link is invalid or has expired.": "Kiungo hiki cha uthibitisho si sahihi au muda wake umeisha.",
    "Your account has no organisation.": "Akaunti yako haina biashara.",
    "Your role does not allow this action.": "Nafasi yako hairuhusu kitendo hiki.",
    "This password is too common.": "Nenosiri hili ni la kawaida mno. Chagua lingine.",
    "This password is entirely numeric.": "Nenosiri haliwezi kuwa namba pekee.",
    "Recipient has opted out.": "Mpokeaji amejiondoa.",
    "Campaign cancelled.": "Kampeni imesitishwa.",
    # demo SMS
    "This account is not eligible for free demo SMS. Activate Bulk SMS to start sending.":
        "Akaunti hii haistahili SMS za majaribio za bure. Wezesha huduma ya SMS kwa Wingi ili uanze kutuma.",
    "Verify your email address to use your free demo SMS.":
        "Thibitisha barua pepe yako ili utumie SMS zako za majaribio za bure.",
    "Your free demo SMS are used up. Activate Bulk SMS with your own Sender ID to keep sending.":
        "SMS zako za majaribio za bure zimeisha. Wezesha SMS kwa Wingi kwa Jina lako la Mtumaji (Sender ID) ili uendelee kutuma.",
    "This number has received the maximum number of demo SMS for today. Try another number.":
        "Namba hii imepokea idadi ya juu ya SMS za majaribio kwa leo. Jaribu namba nyingine.",
    # Sender ID / activation
    "Sender ID must be 3 to 11 letters or numbers and include at least one letter.":
        "Jina la Mtumaji (Sender ID) liwe herufi au namba 3 hadi 11, na liwe na angalau herufi moja.",
    "That Sender ID is reserved. Choose a name that represents your business.":
        "Jina hilo la Mtumaji limehifadhiwa. Chagua jina linalowakilisha biashara yako.",
    "That Sender ID is already registered to another business.": "Jina hilo la Mtumaji tayari limesajiliwa na biashara nyingine.",
    "You already have a Sender ID request in progress.": "Tayari una ombi la Jina la Mtumaji linaloshughulikiwa.",
    "Please fill in all required fields.": "Tafadhali jaza sehemu zote zinazohitajika.",
    "Enter a valid contact phone number.": "Weka namba ya simu ya mawasiliano iliyo sahihi.",
    "Request not found.": "Ombi halikupatikana.",
    "This request can no longer be changed.": "Ombi hili haliwezi kubadilishwa tena.",
    "Give a reason so the customer knows what to fix.": "Toa sababu ili mteja ajue cha kurekebisha.",
    "Unknown action.": "Kitendo hakijulikani.",
    "Language must be sw or en.": "Lugha lazima iwe sw au en.",
    # user management
    "Only the owner can give someone the Admin role.": "Mmiliki pekee ndiye anayeweza kumpa mtu nafasi ya Msimamizi.",
    "Team member not found.": "Mwanatimu hakupatikana.",
    "You cannot change this team member.": "Huwezi kubadilisha mwanatimu huyu.",
    "You cannot give this role.": "Huwezi kutoa nafasi hii.",
    "Your current password is incorrect.": "Nenosiri lako la sasa si sahihi.",
    "Enter your name.": "Weka jina lako.",
    "Enter a valid phone number.": "Weka namba ya simu sahihi.",
    "That is already your email address.": "Hiyo tayari ni barua pepe yako.",
    "This person has already accepted the invitation.": "Mtu huyu tayari amekubali mwaliko.",
    "Only the owner can transfer ownership.": "Mmiliki pekee ndiye anayeweza kuhamisha umiliki.",
    "Ownership can only go to an active member who has signed in.": "Umiliki unaweza kuhamishiwa tu kwa mwanatimu aliye hai ambaye ameshaingia.",
    "User not found.": "Mtumiaji hakupatikana.",
    "You cannot deactivate or remove admin rights from your own account.": "Huwezi kuzima akaunti yako mwenyewe wala kuondoa haki zako za usimamizi.",
    "Only a superuser can change another superuser.": "Msimamizi mkuu pekee ndiye anayeweza kubadilisha msimamizi mkuu mwingine.",
    # credit orders
    "Quantities cannot be negative.": "Idadi haiwezi kuwa hasi.",
    "Choose how many SMS or emails you want to buy.": "Chagua idadi ya SMS au barua pepe unazotaka kununua.",
    "You already have several orders waiting. Pay or cancel one before placing another.":
        "Tayari una oda kadhaa zinazosubiri. Lipia au ghairi moja kabla ya kuweka nyingine.",
    "Could not create the order. Please try again.": "Imeshindwa kuunda oda. Tafadhali jaribu tena.",
    "Order not found.": "Oda haikupatikana.",
    "This order can no longer be changed.": "Oda hii haiwezi kubadilishwa tena.",
    "Enter the transaction ID from your payment confirmation.": "Weka namba ya muamala kutoka kwenye ujumbe wa uthibitisho wa malipo.",
    "Each tier needs a minimum quantity of at least 1 and a price above 0.":
        "Kila ngazi inahitaji idadi ya chini ya angalau 1 na bei zaidi ya 0.",
    "Enter a valid email address.": "Weka barua pepe sahihi.",
}

PATTERNS = [
    (r"^'(.+)' is not a valid phone number\. Use e\.g\. \+255712345678 or 0712345678\.$",
     "'{0}' si namba ya simu sahihi. Tumia mfano +255712345678 au 0712345678."),
    (r"^'(.+)' is not a valid email address\.$", "'{0}' si barua pepe sahihi."),
    (r"^Not enough free demo SMS left \((\d+) left, (\d+) needed\)\. .*$",
     "SMS za majaribio hazitoshi (zimebaki {0}, zinahitajika {1}). Wezesha SMS kwa Wingi kwa Jina lako la Mtumaji ili uendelee kutuma."),
    (r"^This campaign needs (\d+) SMS credits but you have (\d+) free demo SMS left\.$",
     "Kampeni hii inahitaji SMS {0} lakini una SMS {1} za majaribio zilizobaki."),
    (r"^This campaign needs (\d+) (SMS|EMAIL) credits but you have (\d+) left\.$",
     "Kampeni hii inahitaji salio la {1} {0} lakini una {2} tu."),
    (r"^You have no (SMS|EMAIL) credits\. Buy credits or choose a plan to start sending\.$",
     "Huna salio la {0}. Nunua salio au chagua kifurushi ili uanze kutuma."),
    (r"^The maximum per order is (\d+) (SMS|EMAIL)\.$", "Kiwango cha juu kwa oda moja ni {1} {0}."),
    (r"^The minimum order is (\d+) (SMS|EMAIL)\.$", "Oda ya chini kabisa ni {1} {0}."),
    (r"^(SMS|EMAIL) credits are not on sale right now\.$", "Salio la {0} haliuzwi kwa sasa."),
    (r"^Your plan's (SMS|EMAIL) quota is used up \((-?\d+) left, (\d+) needed\)\. Upgrade your plan to continue\.$",
     "Salio la {0} kwenye kifurushi chako limeisha (limebaki {1}, linahitajika {2}). Pandisha kifurushi ili uendelee."),
    (r"^Your plan allows up to (\d+) active API keys\. Revoke one or upgrade your plan\.$",
     "Kifurushi chako kinaruhusu funguo za API {0} tu zinazotumika. Futa mmoja au pandisha kifurushi."),
    (r"^(SMS|EMAIL) is not enabled for your organisation\.$", "Huduma ya {0} haijawezeshwa kwa biashara yako."),
    (r"^This password is too short\. It must contain at least (\d+) characters?\.$",
     "Nenosiri ni fupi mno. Liwe na angalau herufi {0}."),
    (r"^The password is too similar to the (.+)\.$", "Nenosiri linafanana sana na taarifa zako nyingine."),
]
_COMPILED = [(re.compile(p), t) for p, t in PATTERNS]


def translate(message, lang=None):
    lang = lang or current_language.get() or settings.APP_DEFAULT_LANGUAGE
    if lang != "sw" or not message:
        return message
    if message in EXACT:
        return EXACT[message]
    for rx, tpl in _COMPILED:
        m = rx.match(message)
        if m:
            return tpl.format(*m.groups())
    # Several validator messages joined with spaces (password checks)
    parts = re.split(r"(?<=\.) ", message)
    if len(parts) > 1:
        out = [translate(p, lang) for p in parts]
        if out != parts:
            return " ".join(out)
    return message


# ---------------- system emails ----------------
EMAILS = {
    "verify": {
        "en": ("Verify your Promokote email", "Welcome to Promokote",
               "Confirm your email address to finish setting up your account and unlock your free demo SMS.", "Verify email"),
        "sw": ("Thibitisha barua pepe yako ya Promokote", "Karibu Promokote",
               "Thibitisha barua pepe yako ili kukamilisha usajili wa akaunti na kufungua SMS zako za majaribio za bure.",
               "Thibitisha barua pepe"),
    },
    "reset": {
        "en": ("Reset your Promokote password", "Reset your password",
               "Click below to choose a new password. The link expires in 2 hours.", "Reset password"),
        "sw": ("Badilisha nenosiri lako la Promokote", "Badilisha nenosiri",
               "Bofya hapa chini kuchagua nenosiri jipya. Kiungo kitaisha muda baada ya saa 2.", "Badilisha nenosiri"),
    },
    "invite": {
        "en": ("You've been invited to {org} on Promokote", "You're invited",
               "{inviter} invited you to join {org} as {role}. Set your password to get started.", "Accept invitation"),
        "sw": ("Umealikwa kujiunga na {org} kwenye Promokote", "Umealikwa",
               "{inviter} amekualika ujiunge na {org} kama {role}. Weka nenosiri lako ili uanze.", "Kubali mwaliko"),
    },
    "sender_approved": {
        "en": ("Your Sender ID {sender} is approved", "Bulk SMS is active",
               "Your Sender ID {sender} has been approved. Choose an SMS package to start sending to your customers.",
               "Choose a package"),
        "sw": ("Jina lako la Mtumaji {sender} limeidhinishwa", "SMS kwa Wingi imewezeshwa",
               "Jina lako la Mtumaji {sender} limeidhinishwa. Chagua kifurushi cha SMS ili uanze kuwatumia wateja wako.",
               "Chagua kifurushi"),
    },
    "sender_rejected": {
        "en": ("Your Sender ID request needs attention", "Sender ID request not approved",
               "We could not approve the Sender ID {sender}. Reason: {note}. You can correct it and submit a new request.",
               "Open Bulk SMS activation"),
        "sw": ("Ombi lako la Jina la Mtumaji linahitaji marekebisho", "Ombi la Jina la Mtumaji halikuidhinishwa",
               "Hatukuweza kuidhinisha Jina la Mtumaji {sender}. Sababu: {note}. Unaweza kurekebisha na kutuma ombi jipya.",
               "Fungua uwezeshaji wa SMS"),
    },
}

EMAILS["email_changed"] = {
    "en": ("Your Promokote email address was changed", "Email address changed",
           "The email address of your Promokote account was changed to {new}. If you did not do this, reset your password now and contact us.",
           "Reset password"),
    "sw": ("Barua pepe ya akaunti yako ya Promokote imebadilishwa", "Barua pepe imebadilishwa",
           "Barua pepe ya akaunti yako ya Promokote imebadilishwa kuwa {new}. Kama hukufanya hivi, badilisha nenosiri sasa na uwasiliane nasi.",
           "Badilisha nenosiri"),
}

EMAILS["order_approved"] = {
    "en": ("Your order {ref} is approved", "Credits added",
           "Payment for order {ref} is confirmed and the credits are now in your account. You can start sending.",
           "Open Promokote"),
    "sw": ("Oda yako {ref} imeidhinishwa", "Salio limeongezwa",
           "Malipo ya oda {ref} yamethibitishwa na salio limeingia kwenye akaunti yako. Unaweza kuanza kutuma.",
           "Fungua Promokote"),
}
EMAILS["order_rejected"] = {
    "en": ("Your order {ref} needs attention", "Order not approved",
           "We could not approve order {ref}. Reason: {note}. Contact us if you have already paid.", "View my orders"),
    "sw": ("Oda yako {ref} inahitaji ufuatiliaji", "Oda haikuidhinishwa",
           "Hatukuweza kuidhinisha oda {ref}. Sababu: {note}. Wasiliana nasi kama tayari umelipa.", "Ona oda zangu"),
}

ROLE_NAMES = {"sw": {"admin": "Msimamizi", "marketer": "Mtangazaji", "developer": "Msanidi", "viewer": "Mtazamaji"}}


def email_text(kind, lang, **fmt):
    lang = lang if lang in ("sw", "en") else settings.APP_DEFAULT_LANGUAGE
    if "role" in fmt:
        fmt["role"] = ROLE_NAMES.get(lang, {}).get(fmt["role"], fmt["role"])
    fmt = {k: html.escape(str(v)) for k, v in fmt.items()}   # names / notes are user input
    return tuple(s.format(**fmt) for s in EMAILS[kind][lang])
