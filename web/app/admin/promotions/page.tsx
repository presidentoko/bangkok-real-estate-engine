import { PromotionForm } from "@/components/PromotionForm";

export const metadata = { title: "Admin · Add Promotion — RealData" };

export default function AdminPromotionsPage() {
  return (
    <main className="max-w-xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-2">Add Promotion</h1>
      <p className="text-zinc-400 text-sm mb-6">
        Mark a condo as influencer-promoted. The condo must already exist in
        the database (run the pipeline first). On the public Reality page, our
        own price/risk/livability signals will be shown next to the marketing
        claim — &quot;Marketing said X. Data says Y.&quot;
      </p>
      <PromotionForm />
    </main>
  );
}
