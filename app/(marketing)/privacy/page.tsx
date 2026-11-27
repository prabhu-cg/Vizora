import { ContactSection, LegalPage, LegalSection } from "@/components/marketing/legal-page";
import { MARKETING_ROUTES } from "@/lib/marketing/routes";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata = pageMetadata({
  title: "Privacy policy",
  description: "How Vizora handles information: projects and imported files stay in your browser; there are no accounts, analytics or advertising.",
  path: MARKETING_ROUTES.privacy.path,
});

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="27 November 2026"
      intro="Short version: Vizora Free keeps your projects and files on your own device. We do not run accounts, analytics or advertising."
    >
      <LegalSection title="What stays on your device">
        <p>When you use the Vizora application, the following is stored only in your browser on your device, using IndexedDB and local storage:</p>
        <ul>
          <li>Your projects and visualisations, including any data you import.</li>
          <li>Your theme preference (light or dark).</li>
        </ul>
        <p>
          Files you import are read by your browser and are not uploaded to Vizora or to any other service. Because this data lives in your browser, clearing
          your browser’s site data will remove it. You can download a backup from Settings at any time.
        </p>
      </LegalSection>
      <LegalSection title="What the website itself collects">
        <p>
          Vizora does not currently use analytics, advertising or tracking cookies, and does not ask you to create an account or provide personal details. The
          Free edition has no sign-in.
        </p>
        <p>
          The website is delivered by a hosting provider. Like any web host, it processes standard technical request information, such as IP address, browser
          type and the time and address of each request, in order to serve pages and keep the service secure. We do not use this to identify you.
        </p>
      </LegalSection>
      <LegalSection title="Third parties">
        <p>
          Fonts are included with the website and are not loaded from a third-party font service when you visit. Apart from the hosting provider above, your
          information is not shared with other services by the Free edition.
        </p>
      </LegalSection>
      <LegalSection title="Your choices">
        <ul>
          <li>Export your data from the application whenever you like.</li>
          <li>Delete projects in the application, or clear this site’s data in your browser to remove everything.</li>
        </ul>
      </LegalSection>
      <LegalSection title="Children">
        <p>Vizora is a general-purpose tool and is not directed at children. It collects no personal information from anyone.</p>
      </LegalSection>
      <LegalSection title="Changes to this policy">
        <p>
          If Vizora changes in a way that affects how information is handled, for example when optional accounts or cloud features are introduced in a future
          edition, this policy will be updated before that happens and the date above will change.
        </p>
      </LegalSection>
      <ContactSection />
    </LegalPage>
  );
}
