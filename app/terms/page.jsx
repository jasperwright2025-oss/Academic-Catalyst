import LegalLayout, { LegalSection, LegalList } from "@/components/LegalLayout";
import { LEGAL } from "@/lib/legal";

export const metadata = {
  title: `Terms of Service | ${LEGAL.productName}`,
  description: `The terms for using ${LEGAL.productName}.`,
};

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service">
      <LegalSection title="1. About these terms">
        <p>
          These terms are an agreement between you and {LEGAL.legalEntity} (&quot;we&quot;, &quot;us&quot;), the
          operator of {LEGAL.productName}. By creating an account or using the service you agree to them and to our
          Privacy Policy. If you do not agree, please do not use the service.
        </p>
      </LegalSection>

      <LegalSection title="2. Built by practitioners, for practitioners">
        <p>
          {LEGAL.productName} was built by research practitioners for practitioners. It is meant for professionals who
          need a strong starting point and clear thinking, including:
        </p>
        <LegalList
          items={[
            "researchers planning feasibility or pilot studies;",
            "researchers testing questionnaires, interview guides and other instruments before field work;",
            "postgraduate trainers, lecturers and supervisors preparing marking schemes and gaining clarity on a topic before they work with students; and",
            "consultants carrying out viability and feasibility studies for clients.",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Your account">
        <LegalList
          items={[
            "You must be at least 18 years old and give accurate information when you register.",
            "Keep your password safe. You are responsible for everything done through your account, and one account is for one person.",
            "Tell us promptly if you think someone else has used your account.",
          ]}
        />
      </LegalSection>

      <LegalSection title="4. What the service provides">
        <LegalList
          items={[
            "Research proposals, including the supporting data collection tools.",
            "Simulated data packages for pilots, instrument testing and teaching.",
            "Reports compiled from the proposal, data and notes that you supply.",
            "A free preview of a proposal, so you can see the quality before you unlock the full document.",
          ]}
        />
        <p>
          The documents are prepared with the help of artificial intelligence. They are a working draft to be read,
          checked and adapted by you.
        </p>
      </LegalSection>

      <LegalSection title="5. Responsible and lawful use">
        <p>You agree that you will:</p>
        <LegalList
          items={[
            "follow the academic integrity and research ethics rules of your institution, funder and professional body, and not present the service's output as your own work where those rules do not allow it;",
            "never present simulated data as real field data, and never use the service to invent or falsify research findings;",
            "have the right and, where needed, the participants' consent and ethics approval to submit any data, transcripts or notes, and anonymise personal details before you submit them;",
            "not use the service for anything unlawful, harmful, harassing or misleading;",
            "not share your account, resell the service, copy it, scrape it, or try to break or bypass its security or limits; and",
            "not misuse the free preview, for example by opening several accounts to get more previews.",
          ]}
        />
        <p>We may suspend or close accounts that break these rules.</p>
      </LegalSection>

      <LegalSection title="6. Simulated data">
        <p>
          The data generated in a data simulation package is simulated. It is intended for pilots, instrument testing
          and teaching. The participants are not real, and it is not real field data. Every package says so, and each
          simulated item is marked SIMULATED. Reports compiled from simulated data state this clearly.
        </p>
      </LegalSection>

      <LegalSection title="7. Artificial intelligence and checking the output">
        <LegalList
          items={[
            "Output made by artificial intelligence can contain mistakes, gaps and out-of-date information.",
            "We design the service to look up and confirm sources, and each proposal or report ends with a note on the checks made. We cannot guarantee that every citation, quotation, statistic or reference is accurate or complete.",
            "You must check every citation, quotation, statistic and reference yourself before you rely on or submit it.",
            "The output is not legal, medical, financial or other professional advice, and we do not promise that any institution, examiner, funder, client or ethics committee will accept it.",
          ]}
        />
      </LegalSection>

      <LegalSection title="8. Your content and the output">
        <p>
          You keep your rights in everything you submit. You give us permission to process it, store it and send it to
          our service providers only so that we can provide the service to you. As between you and us, you own the
          output prepared for you, to the extent the law allows. Because the same kind of question can lead to similar
          wording for different people, we do not promise that your output is unique. We do not use your content to
          train artificial intelligence models.
        </p>
      </LegalSection>

      <LegalSection title="9. Prices, credits and payment">
        <LegalList
          items={[
            "Prices are shown in US dollars. You can pay by mobile money (MTN or Airtel) in Uganda shillings at the amount shown when you place the order, in USDT on the TRON network, and by card when that option is available.",
            "Mobile money payments are confirmed by a person after you enter your transaction ID, so credits may take some time to appear.",
            "For USDT, send exactly the amount and use exactly the network shown. A payment sent on another network, or for a different amount, may not be recognised and may be impossible to recover.",
            "A single purchase gives you the credit described at checkout. A monthly plan keeps its benefits active for one month from each payment, and you need to pay again to continue. Card payers may be offered automatic renewal and can cancel it at any time.",
            "One free preview is available per account. Unlocking a preview uses one proposal credit.",
            "Prices may change. A change does not affect orders you have already paid for.",
          ]}
        />
      </LegalSection>

      <LegalSection title="10. Refunds">
        <p>
          Documents are produced and unlocked immediately, and generating them has a real cost, so payments for
          documents that have been generated or unlocked are normally not refundable. You can ask for a refund, or for
          the credit to be restored, within {LEGAL.refundWindowDays} days if:
        </p>
        <LegalList
          items={[
            "your payment was taken but you did not receive the credits;",
            "you paid twice for the same order; or",
            "a technical fault meant that no usable document was produced.",
          ]}
        />
        <p>
          Write to {LEGAL.contactEmail} with your account email and payment details. When we assess a request we may check our records, including whether the document was unlocked, downloaded, copied or printed. Your legal rights as a consumer are not affected.
        </p>
      </LegalSection>

      <LegalSection title="11. Availability and changes to the service">
        <p>
          We work to keep the service available but cannot promise it will always be uninterrupted or error free. It
          relies on services run by others, which may be unavailable at times. We may change, add or remove features.
        </p>
      </LegalSection>

      <LegalSection title="12. Suspension and ending">
        <p>
          You can stop using the service and ask us to close your account at any time. We may suspend or end your
          access if you break these terms, if we suspect fraud or abuse, or if the law requires it. Rules that by their
          nature continue after that, such as those on payment, liability and governing law, stay in force.
        </p>
      </LegalSection>

      <LegalSection title="13. Our responsibility to you">
        <p>
          The service is provided &quot;as is&quot;. To the fullest extent the law allows, we are not responsible for
          indirect or consequential loss, loss of profit or opportunity, or for decisions made or work submitted on the
          basis of the output. Our total responsibility to you for any claim is limited to the amount you paid us in
          the three months before the event that gave rise to it. Nothing in these terms limits liability that cannot
          be limited by law.
        </p>
      </LegalSection>

      <LegalSection title="14. Governing law and disputes">
        <p>
          These terms are governed by the laws of the Republic of Uganda. If you have a complaint, please contact us
          first so that we can try to resolve it. If we cannot, the courts of Uganda will have jurisdiction.
        </p>
      </LegalSection>

      <LegalSection title="15. Changes to these terms">
        <p>
          We may update these terms. The effective date above shows the latest version. If you keep using the service
          after a change takes effect, you accept the updated terms. For significant changes we will tell you by email
          or on the website.
        </p>
      </LegalSection>

      <LegalSection title="16. Contact">
        <p>
          {LEGAL.legalEntity}, {LEGAL.postalAddress}. Email: {LEGAL.contactEmail}.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
