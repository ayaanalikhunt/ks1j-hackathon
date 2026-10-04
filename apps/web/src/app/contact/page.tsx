import { SiteHeader } from "@/components/SiteHeader";
import { Card, PageHeader } from "@/components/ui";

export default function Contact() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <PageHeader eyebrow="Get in touch" title="Contact the Jamaat office" />
        <Card className="space-y-1">
          <p>Phone: +91 12345 67890</p>
          <p>Mumbai, Maharashtra</p>
        </Card>
      </main>
    </>
  );
}
