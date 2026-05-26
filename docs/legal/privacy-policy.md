# Privacy Policy

**Effective:** 26 May 2026
**Last updated:** 26 May 2026
**Data controller:** Digital Relative Ltd (registered in England and Wales)
**Contact for data requests:** privacy@digitalrelative.co.uk

This Privacy Policy describes how Digital Relative ("we", "us") collects, uses and protects personal data when you use digitalrelative.co.uk and our service.

---

## 1. What we collect

| Category | Examples | Why we collect it |
|---|---|---|
| **Account identifiers** | Email address, password hash, OAuth identifiers (Google / Apple) | To create and authenticate your account |
| **Profile data** | Name, optional phone number, marketing-opt-in flag, language preference | To personalise the service and send notifications you opt into |
| **Vault data** | Account names, encrypted credentials, encrypted notes, documents you upload | This is the core of the service. All sensitive fields are end-to-end encrypted with a key derived from your vault PIN — we cannot read them. |
| **Family records** | Names, dates of birth, contact info for dependants you choose to add | To make this information available to your beneficiaries when the conditions you've configured are met |
| **Beneficiary info** | Names, emails, access tiers for the people you nominate | To deliver vault access when triggered |
| **Billing data** | Stripe customer ID, subscription ID, plan, renewal date | To run subscriptions. Card numbers never touch our servers — they go directly to Stripe. |
| **Technical** | IP address (truncated, only logged on sign-in events), browser user-agent, timestamp of access | Security audit trail and to detect unfamiliar sign-ins |
| **Cookies** | Authentication cookies, preference cookies, service-worker storage | To keep you signed in and provide the offline experience |

We do not collect location data beyond country/city inferred from IP at sign-in time. We do not collect behavioural advertising data. We do not buy or receive data about you from third parties.

---

## 2. How your vault data is protected

- Encryption at rest in your browser: AES-256-GCM
- Encryption key derivation: PBKDF2-SHA-256, 600,000 iterations, per-user random salt
- Vault PIN is never stored in plaintext anywhere
- Storage on Supabase EU (Ireland) — your encrypted vault never leaves the EEA
- We do not have a backdoor; if you forget your vault PIN and lose your recovery codes, your data is permanently inaccessible

The optional trusted-device feature stores an additional encrypted copy of the PIN bound to a platform credential (Touch ID, Windows Hello) or to a device token in your browser. You can revoke trust at any time in Settings.

---

## 3. Legal basis for processing

Under UK GDPR, our lawful bases are:

- **Contract** (Article 6(1)(b)) — for everything required to provide the service you signed up to: account, vault, beneficiary handling, billing
- **Legitimate interests** (Article 6(1)(f)) — for fraud prevention, security audit logging, and product improvement through aggregated, non-identifying analysis
- **Consent** (Article 6(1)(a)) — for marketing emails and non-essential cookies. You can withdraw consent at any time
- **Legal obligation** (Article 6(1)(c)) — for responding to law enforcement requests and complying with tax law

---

## 4. Who we share data with

We never sell your data. We share data only with the following sub-processors, each under a Data Processing Agreement:

| Sub-processor | Purpose | Location |
|---|---|---|
| **Supabase** (Supabase, Inc.) | Database, authentication, file storage, edge functions | EU (Ireland) |
| **Vercel** (Vercel Inc.) | Web hosting and CDN for the front-end | Global edge |
| **Stripe** (Stripe Payments UK Ltd) | Subscription billing, payment processing | UK / Ireland |
| **Resend** (Resend, Inc.) | Transactional email delivery | EU |
| **Crisp** (Crisp IM SARL) | Customer support chat | France |
| **Loqate / AddressNow** (GBG plc) | UK address lookup autocomplete | UK |
| **Onfido** (Onfido Ltd) | Identity verification for emergency-access requests | UK / EU |

Each processor's current Data Processing Agreement is available on request.

**Other recipients:**

- **Your beneficiaries** receive only the data you have explicitly shared with them, when the access conditions you set are met
- **Law enforcement** receives data only if compelled by a valid UK court order. We log every such request.

We do not transfer data outside the EEA / UK except where the sub-processor is certified under an adequacy decision (the UK–US Data Bridge / EU–US DPF where applicable).

---

## 5. How long we keep your data

- **Active account data**: for as long as your account is open
- **After account deletion**: encrypted vault contents are purged within 30 days; your account email is retained for 90 days in case of accidental deletion; backups are rotated out within 90 days
- **Billing records**: 7 years, as required by HMRC
- **Audit log of security events**: 90 days
- **Shared-vault data after couples separation**: 90-day export window, then deleted

---

## 6. Your rights

Under UK GDPR you have the right to:

- **Access** the personal data we hold about you (request via privacy@digitalrelative.co.uk)
- **Rectification** of inaccurate data — most fields you can edit yourself in the app; for others, email us
- **Erasure** ("right to be forgotten") — Settings → Delete account, or email us. Some data may be retained for legal obligations (see retention above)
- **Restriction** of processing — email us
- **Portability** — Settings → Export, or email us; we will provide a JSON export of your data
- **Object** to processing — email us; we will stop unless we have a compelling legitimate interest
- **Withdraw consent** at any time, for the things you consented to (marketing, non-essential cookies)
- **Lodge a complaint** with the UK Information Commissioner's Office: https://ico.org.uk/make-a-complaint/

We respond to all data-subject requests within 30 days.

---

## 7. Cookies and similar technologies

We use:

- **Strictly necessary cookies** — authentication session token, CSRF token, locale preference. Cannot be disabled.
- **Service-worker storage** — used for the progressive web app shell and push notifications. Functional, not tracking.
- **Crisp chat session** — set only after you accept non-essential cookies in our cookie banner. Functional, not advertising.

We do not use advertising cookies, analytics cookies, or third-party tracking.

You can review your cookie preferences any time in Settings → Cookie preferences.

---

## 8. Children

Digital Relative is not intended for users under 18. We do not knowingly collect data from anyone under 18. If you believe a child has signed up, email privacy@digitalrelative.co.uk and we will delete the account.

---

## 9. Security incidents

If we discover a data breach affecting your personal data we will:

- Notify the ICO within 72 hours where required
- Notify you without undue delay if there is a high risk to your rights and freedoms
- Publish details on a public security page at digitalrelative.co.uk/security once the incident is contained

Report a suspected vulnerability: security@digitalrelative.co.uk.

---

## 10. Changes to this policy

We will email you if we make a material change. Minor wording updates are reflected in the "Last updated" date at the top of this page.

---

## 11. Contact

- General: hello@digitalrelative.co.uk
- Data requests: privacy@digitalrelative.co.uk
- Security disclosure: security@digitalrelative.co.uk
