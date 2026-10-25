import LegalLayout, { LegalSection, LegalList } from "@/components/LegalLayout";
import { LEGAL } from "@/lib/legal";

export const metadata = {
  title: `Privacy Policy | ${LEGAL.productName}`,
  description: `How ${LEGAL.productName} collects, uses and protects personal data.`,
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy">
      <LegalSection title="1. Who we are">
        <p>
          {LEGAL.productName} was built by research practitioners, for practitioners. It helps researchers who are
          planning feasibility or pilot studies, testing research instruments, preparing postgraduate teaching and
          marking schemes, or carrying out viability studies as consultants. This policy explains what personal data we
          collect when you use the service, why we collect it, who we share it with, and the choices you have.
        </p>
        <p>
          The service is operated by {LEGAL.legalEntity}, {LEGAL.postalAddress} (&quot;we&quot;, &quot;us&quot;). We
          are responsible for your personal data under Uganda&apos;s Data Protection and Privacy Act, 2019. {LEGAL.pdpoRegistration
            ? ` Our registration number with the Personal Data Protection Office is ${LEGAL.pdpoRegistration}.`
            : ""}{" "}
          You can contact us at{" "}
          {LEGAL.contactEmail}.
        </p>
      </LegalSection>

      <LegalSection title="2. The information we collect">
        <LegalList
          items={[
            "Account details: your name, your email address, and your password. Your password is handled by our authentication provider and is stored in a protected form. We never see it in readable form.",
            "Cover page details: your position, organisation, registration number, programme and supervisors, if you choose to add them, so that we can complete the cover page of your documents.",
            "What you give us to work on: your research topic, target institution, project background, and anything you paste in, such as a proposal, data, field notes or interview transcripts.",
            "What we create for you: the proposals, simulated data packages and reports generated for your account, and the previews and documents saved in your history.",
            "Payment records: what you bought, the amount, the date, and the status of the payment. For mobile money we record the transaction ID you enter. For USDT we record the blockchain transaction ID and amount. For cards, the card payment page is run by our payment provider, and we do not receive or store your card number.",
            "Usage records: when you unlock, download, copy or print a document. We keep these to prevent fraud and to check refund requests.",
            "Technical information: standard server records such as your IP address, browser type and the time of each request, kept by our hosting provider for security and troubleshooting. We use cookies only to keep you signed in.",
          ]}
        />
        <p>
          Please do not paste into the service anything that identifies research participants, such as names, phone
          numbers or other personal details, unless you have the right to share it and have taken the steps your
          ethics approval requires. Anonymise participant data before you submit it.
        </p>
      </LegalSection>

      <LegalSection title="3. How we use your information">
        <LegalList
          items={[
            "To create and run your account and to provide the service you ask for.",
            "To process payments, confirm them, and give you the credits or plan you paid for.",
            "To prevent fraud, abuse and misuse of the service, to check refund requests against our records, and to keep it secure.",
            "To answer your questions, handle refund requests and provide support.",
            "To meet our legal, tax and accounting obligations.",
          ]}
        />
        <p>
          We do not sell your personal data. We do not use your content to train artificial intelligence models, and
          our AI provider is not permitted to train its models on it either.
        </p>
      </LegalSection>

      <LegalSection title="4. Your consent and our lawful basis">
        <p>
          We process your personal data with your consent, which you give when you create your account, and where it
          is necessary to provide the service you have asked for, to take payment, or to comply with the law. You can
          withdraw your consent at any time by closing your account or writing to us, although we may then be unable
          to continue providing the service.
        </p>
      </LegalSection>

      <LegalSection title="5. Who we share your information with">
        <p>We use the following service providers to run the service. They receive only what they need to do their job.</p>
        <LegalList
          items={[
            "Supabase: our database and sign-in provider. Your account, documents and payment records are stored there. The database is currently hosted in Sweden.",
            "Vercel: hosts the website and the server code.",
            "Anthropic: the artificial intelligence provider. The topic, background and other content you submit are sent to Anthropic to generate your document. Anthropic's commercial terms state that it may not train its models on this content, and it keeps API inputs and outputs only for a limited period under its published policy.",
            "Web search: while preparing a proposal or report, the AI may search the web to find and confirm real sources. Search queries are based on your research topic.",
            "Payment providers: Pesapal handles card payments when enabled. Mobile money payments are made directly to our mobile money number. USDT payments are made on the public TRON blockchain, where transfers are visible to anyone.",
          ]}
        />
        <p>
          We may also disclose information when the law requires it, to protect our rights or the safety of others, or
          in connection with the sale or restructuring of our business, in which case this policy will continue to
          apply to your data.
        </p>
      </LegalSection>

      <LegalSection title="6. Transfers outside Uganda">
        <p>
          Our service providers are located in, or process data in, countries outside Uganda, including Sweden and the
          United States. By creating an account you consent to your personal data being transferred to and processed in
          those countries. We choose providers that commit to protecting the data they handle.
        </p>
      </LegalSection>

      <LegalSection title="7. How long we keep your information">
        <LegalList
          items={[
            "Account details and the documents in your history are kept while your account is open, unless you delete them first.",
            "Payment records are kept for as long as we need them for accounting, tax and legal purposes.",
            "When a preview is unlocked, or its document is deleted, the locked copy of the full text is removed.",
            "Our service providers keep technical records and AI inputs for the periods in their own published policies.",
          ]}
        />
      </LegalSection>

      <LegalSection title="8. Your rights">
        <p>You have the right to:</p>
        <LegalList
          items={[
            "ask what personal data we hold about you and receive a copy;",
            "ask us to correct data that is wrong or out of date;",
            "ask us to delete your data, or to stop using it, where the law allows;",
            "object to certain uses of your data and withdraw your consent; and",
            "complain to the Personal Data Protection Office in Uganda if you believe we have not handled your data properly.",
          ]}
        />
        <p>
          To use these rights, write to {LEGAL.contactEmail}. We will respond within a reasonable time and may need to
          confirm your identity first. You can delete individual documents yourself from your dashboard.
        </p>
      </LegalSection>

      <LegalSection title="9. Security">
        <p>
          We protect your data with encrypted connections, access controls, and database rules that limit each account
          to its own records. No system is completely secure. If a breach affects your personal data, we will notify
          you and the authorities as the law requires.
        </p>
      </LegalSection>

      <LegalSection title="10. Cookies">
        <p>
          We use only the cookies that are necessary to keep you signed in. We do not use advertising or tracking
          cookies.
        </p>
      </LegalSection>

      <LegalSection title="11. Who may use the service">
        <p>
          The service is for professional use by adults. You must be at least 18 years old to create an account. We do
          not knowingly collect personal data from children.
        </p>
      </LegalSection>

      <LegalSection title="12. Changes to this policy">
        <p>
          We may update this policy from time to time. The effective date at the top shows when it last changed. If
          the changes are significant, we will tell you by email or on the website.
        </p>
      </LegalSection>

      <LegalSection title="13. Contact">
        <p>
          {LEGAL.legalEntity}, {LEGAL.postalAddress}. Email: {LEGAL.contactEmail}.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
