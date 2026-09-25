export function AdminAutomationTemplatesPanel() {
  return (
    <div>
      <div className="mb-[18px]">
        <div className="text-[18px] font-bold text-[#17171A]">Templates</div>
        <div className="text-[12.5px] text-[#8B8B92] mt-1">
          Reusable automation starter packs for common workflows
        </div>
      </div>
      <div className="bg-white border border-black/[0.08] rounded-[14px] overflow-hidden">
        <div className="px-[18px] py-10 text-center">
          <p className="text-[14px] font-semibold text-[#17171A] mb-1">No templates yet</p>
          <p className="text-[13px] text-[#8B8B92] m-0 max-w-sm mx-auto">
            Automation templates will appear here once they are available for this project.
          </p>
        </div>
      </div>
    </div>
  );
}
