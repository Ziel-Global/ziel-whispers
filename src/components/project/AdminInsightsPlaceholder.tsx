type Props = {
  title: string;
  subtitle: string;
};

/** Placeholder shell for Insights secondaries (Workload / Time / Delivery) until content is defined. */
export function AdminInsightsPlaceholder({ title, subtitle }: Props) {
  return (
    <div>
      <div className="mb-[18px]">
        <div className="text-[18px] font-bold text-[#17171A]">{title}</div>
        <div className="text-[12.5px] text-[#8B8B92] mt-1">{subtitle}</div>
      </div>
      <div className="bg-white border border-black/[0.08] rounded-[14px] p-[22px]">
        <p className="text-[13px] text-[#8B8B92] py-10 text-center m-0">Content coming soon.</p>
      </div>
    </div>
  );
}
