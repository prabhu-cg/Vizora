import { ContactSection, LegalPage, LegalSection } from "@/components/marketing/legal-page";
import { MARKETING_ROUTES } from "@/lib/marketing/routes";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata = pageMetadata({
  title: "Terms of service",
  description: "The terms for using the free edition of Vizora, including your content, acceptable use and what is not promised.",
  path: MARKETING_ROUTES.terms.path,
});

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="27 November 2026" intro="These terms apply to the Vizora website and the Free edition of the Vizora application.">
      <LegalSection title="Using Vizora">
        <p>By using Vizora you agree to these terms. If you do not agree, please do not use it. The Free edition is provided at no charge and requires no account.</p>
      </LegalSection>
      <LegalSection title="Your content">
        <p>
          You own what you create. Your projects and imported files are stored in your browser on your device; Vizora does not receive or hold a copy.
          You are responsible for keeping backups, because clearing browser data, changing browsers or losing a device can permanently remove your work.
        </p>
      </LegalSection>
      <LegalSection title="Acceptable use">
        <p>You agree not to misuse Vizora, including by attempting to disrupt the website, probe it for vulnerabilities without permission, or use it to break the law or infringe others’ rights.</p>
      </LegalSection>
      <LegalSection title="Features, plans and prices">
        <p>
          Features described as planned, in development, Pro or Team are not available and are not promised. Indicative prices shown for planned plans are not
          offers and may change or never be introduced. Vizora may change, add or remove features of the Free edition.
        </p>
      </LegalSection>
      <LegalSection title="No warranty">
        <p>
          Vizora is provided “as is” and “as available”. To the extent permitted by law, we do not warrant that it will be uninterrupted, error-free or
          suitable for a particular purpose, or that your data will not be lost.
        </p>
      </LegalSection>
      <LegalSection title="Limitation of liability">
        <p>
          To the extent permitted by law, we are not liable for indirect or consequential loss, or for loss of data or profits, arising from your use of
          Vizora. Nothing in these terms limits liability that cannot be limited by law.
        </p>
      </LegalSection>
      <LegalSection title="Changes to these terms">
        <p>We may update these terms. The date above shows the latest version; continuing to use Vizora after a change means you accept the updated terms.</p>
      </LegalSection>
      <ContactSection />
    </LegalPage>
  );
}
