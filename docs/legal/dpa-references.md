# Data Processing Agreement (DPA) — reference checklist

Each third-party processor we use offers a DPA that you (as data controller) need to accept. Most offer a click-through or download-and-sign form in their dashboard. Tick once accepted/signed.

| Processor | What they process | Where to accept |
|---|---|---|
| [ ] **Supabase** | Vault data (encrypted), profile, auth | Dashboard → Settings → Account → Data Processing Agreement. Click-through. Higher tier plans get a signed copy on request. |
| [ ] **Vercel** | Web hosting, CDN access logs | Dashboard → Settings → Security & Privacy → Data Processing Addendum. Click-through. |
| [ ] **Stripe** | Customer name, email, card token (Stripe holds the card itself), subscription history | Dashboard → Settings → Compliance and reporting → Data Processing Agreement. Click-through. |
| [ ] **Resend** | Recipient email addresses, email content (transactional) | Dashboard → Settings → Legal → DPA. |
| [ ] **Crisp** | Chat transcripts, visitor email if you collect it | Dashboard → Settings → Workspace → Privacy → DPA. |
| [ ] **Loqate / GBG** (AddressNow) | Search queries (postcode/address fragments) | Contact GBG sales — usually executed once during account setup. |
| [ ] **Onfido** | ID document images, selfies, verification results — only for emergency-access requests | Contact Onfido sales — executed as part of the onboarding contract. |

## Standard contractual clauses (SCCs)

For any processor that transfers data outside the UK / EEA, the DPA should include UK / EU SCCs. All the providers above offer them by default in their current DPA template.

## Sub-processor list

Each DPA grants the processor permission to use their own sub-processors (e.g. AWS for Supabase's hosting). Most DPAs include a public sub-processor list — review them and document any objections in writing within the timeframe their DPA specifies.

## Notes for the lawyer review

- Confirm DPA wording works for our specific use of each provider (the click-through ones are usually fine but worth a glance)
- Confirm we have a documented procedure for data-subject access requests that involves the processors (e.g. how do we export a customer's Stripe history if requested)
- Confirm our retention timelines in the Privacy Policy align with what each processor actually does
- Confirm we are correctly named as data controller, not data processor, in each agreement
