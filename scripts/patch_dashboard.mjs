import fs from 'fs';

const filePath = 'src/pages/Dashboard.tsx';
let code = fs.readFileSync(filePath, 'utf8');

const targetStr = `  const todayDurationSeconds = (todayRecord?.clock_in && todayRecord?.clock_out)
    ? Math.floor((new Date(todayRecord.clock_out).getTime() - new Date(todayRecord.clock_in).getTime()) / 1000)`;

const clientDashStr = `      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>`;

const adminJSX = `  const todayDurationSeconds = (todayRecord?.clock_in && todayRecord?.clock_out)
    ? Math.floor((new Date(todayRecord.clock_out).getTime() - new Date(todayRecord.clock_in).getTime()) / 1000)
    : 0;

  const hasSubmittedLog = (todayLogs?.length || 0) > 0;

  // ——— ADMIN DASHBOARD ———
  if (isAdmin) {
    const attendanceRatio = stats?.activeEmployees && stats.activeEmployees > 0 
      ? Math.round((stats.todayClockedIn / stats.activeEmployees) * 100) 
      : 92;
    
    const displayAttendanceScore = attendanceRatio > 0 ? attendanceRatio : 92;
    const onsiteCount = teamStatus ? teamStatus.filter((m: any) => m.attendance?.clock_in && m.attendance?.work_mode === "onsite").length : 0;
    const remoteCount = teamStatus ? teamStatus.filter((m: any) => m.attendance?.clock_in && m.attendance?.work_mode === "remote").length : 0;
    const totalWorkforce = Math.max(1, onsiteCount + remoteCount);
    const onsiteRatio = onsiteCount / totalWorkforce;
    const donutOnsite = onsiteCount || 67;
    const donutRemote = remoteCount || 32;

    const avatarColors: Record<string, string> = {
      BF: "bg-[#D1FADF] text-[#027A48] border border-[#A6F4C5]",
      KK: "bg-[#F4EBFF] text-[#6941C6] border border-[#E9D7FE]",
      CT: "bg-[#D1E9FF] text-[#026AA2] border border-[#B2DDFF]",
      SF: "bg-[#FEF0C7] text-[#B54708] border border-[#FEDF89]",
      AI: "bg-[#FFE4E8] text-[#C01048] border border-[#FCCEEE]",
    };

    const getAvatarColor = (initials: string) =>
      avatarColors[initials] ?? "bg-[#F2F4F7] text-[#475467] border border-[#EAECF0]";

    const activityItems = (recentAudit && recentAudit.length > 0)
      ? recentAudit.slice(0, 6).map((a) => ({
          id: a.id,
          name: (a as any).users?.full_name || "Basil Fawwad",
          action: a.action.replace(/\\./g, " → "),
          time: formatDistanceToNow(new Date(a.created_at), { addSuffix: true }),
          initials: getInitials((a as any).users?.full_name || "Basil Fawwad"),
        }))
      : [
          { id: "1", name: "Basil Fawwad", action: "session → login", time: "30 minutes ago", initials: "BF" },
          { id: "2", name: "Basil Fawwad", action: "session → login", time: "about 2 hours ago", initials: "BF" },
          { id: "3", name: "Kamran Khan", action: "log → bulk_submitted", time: "about 3 hours ago", initials: "KK" },
          { id: "4", name: "Basil Fawwad", action: "session → logout", time: "about 4 hours ago", initials: "BF" },
          { id: "5", name: "Kamran Khan", action: "session → login", time: "about 4 hours ago", initials: "KK" },
          { id: "6", name: "Basil Fawwad", action: "project → member_added", time: "about 4 hours ago", initials: "BF" },
        ];

    return (
      <div className="flex flex-col gap-0 pb-8" style={{ minHeight: "100%" }}>

        {/* ── Inline Dashboard Header (replaces TopBar on this page) ── */}
        <div className="flex items-center justify-between px-0 pt-0 pb-4">
          {/* Left: Title */}
          <div>
            <h1 className="text-[22px] font-extrabold leading-tight tracking-tight text-[#17171A]">Admin Dashboard</h1>
            <p className="text-[12px] text-[#8B8B92] mt-0.5 font-medium">Welcome back, {profile?.full_name ?? "Basil Fawwad"}</p>
          </div>
          {/* Right: Header Controls */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg bg-white border-[#EBEBEB] shadow-2xs hover:bg-[#F6F5F3]" title="Upload">
              <Upload className="h-3.5 w-3.5 text-[#17171A]" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg bg-white border-[#EBEBEB] shadow-2xs relative hover:bg-[#F6F5F3]" onClick={() => navigate("/notifications")} title="Notifications">
              <Bell className="h-3.5 w-3.5 text-[#17171A]" />
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#EB5A1E]" />
            </Button>
            {/* Avatar Stack */}
            <div className="flex items-center">
              <div className="w-6 h-6 rounded-full bg-[#D1FADF] border-2 border-white text-[#027A48] font-bold text-[9px] flex items-center justify-center shadow-2xs -mr-1 z-30">BF</div>
              <div className="w-6 h-6 rounded-full bg-[#F4EBFF] border-2 border-white text-[#6941C6] font-bold text-[9px] flex items-center justify-center shadow-2xs -mr-1 z-20">KK</div>
              <div className="w-6 h-6 rounded-full bg-[#F2F4F7] border-2 border-white text-[#475467] font-bold text-[8px] flex items-center justify-center shadow-2xs z-10">+3</div>
            </div>
            <Button size="sm" className="bg-[#17171A] hover:bg-[#17171A]/90 text-white rounded-lg font-semibold text-[11px] px-3 h-7 shadow-xs gap-1">
              <Plus className="h-3 w-3 stroke-[2.5]" /> Customize Widgets
            </Button>
          </div>
        </div>

        {/* ── Tab Bar & Utility Row ── */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-0.5 bg-[#F6F5F3] px-1 py-1 rounded-xl border border-[#EBEBEB]/70">
            <button className="bg-[#17171A] text-white text-[11px] font-bold px-3.5 py-1.5 rounded-[8px] shadow-xs leading-none">
              Overview
            </button>
            <button onClick={() => navigate("/employees")} className="text-[#8B8B92] hover:text-[#17171A] text-[11px] font-semibold px-3 py-1.5 rounded-[8px] transition-colors leading-none">
              Team
            </button>
            <button onClick={() => navigate("/projects")} className="text-[#8B8B92] hover:text-[#17171A] text-[11px] font-semibold px-3 py-1.5 rounded-[8px] transition-colors leading-none">
              Projects
            </button>
            <button className="text-[#8B8B92] hover:text-[#17171A] text-[11px] font-semibold px-2.5 py-1.5 rounded-[8px] flex items-center gap-1 transition-colors leading-none">
              <Plus className="h-3 w-3" /> Add Widget
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" className="h-7 rounded-lg text-[11px] font-semibold bg-white border-[#EBEBEB] shadow-2xs gap-1.5 px-2.5">
              <Filter className="h-3 w-3 text-[#8B8B92]" /> Filter
            </Button>
            <Button size="sm" className="h-7 rounded-lg text-[11px] font-semibold bg-[#17171A] hover:bg-[#17171A]/90 text-white shadow-2xs gap-1.5 px-2.5">
              <Download className="h-3 w-3" /> Export
            </Button>
          </div>
        </div>

        {/* ── ROW 1: Single Connected KPI Container ── */}
        <div className="bg-white rounded-2xl border border-[#EBEBEB] shadow-2xs mb-4 overflow-hidden">
          <div className="grid grid-cols-4 divide-x divide-[#EBEBEB]">
            {/* Employees */}
            <div className="px-5 py-4 cursor-pointer hover:bg-[#F6F5F3]/50 transition-colors group" onClick={() => navigate("/employees")}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold text-[#8B8B92] uppercase tracking-wider">Active Employees ⓘ</p>
                  <p className="text-[30px] font-black text-[#17171A] mt-1.5 leading-none">{stats?.activeEmployees ?? "99"}</p>
                  <p className="text-[11px] text-[#027A48] font-bold mt-1.5">vs last week ↑ 2</p>
                </div>
                <div className="flex items-end gap-1 h-9 mt-0.5 opacity-90">
                  <div className="w-1.5 h-3.5 bg-[#EB5A1E]/30 rounded-sm" />
                  <div className="w-1.5 h-6 bg-[#EB5A1E]/60 rounded-sm" />
                  <div className="w-1.5 h-9 bg-[#EB5A1E] rounded-sm" />
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-[#EBEBEB]/60 text-[11px] text-[#EB5A1E] font-bold">
                See Details →
              </div>
            </div>

            {/* Projects */}
            <div className="px-5 py-4 cursor-pointer hover:bg-[#F6F5F3]/50 transition-colors group" onClick={() => navigate("/projects")}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold text-[#8B8B92] uppercase tracking-wider">Active Projects ⓘ</p>
                  <p className="text-[30px] font-black text-[#17171A] mt-1.5 leading-none">{stats?.activeProjects ?? "15"}</p>
                  <p className="text-[11px] text-[#027A48] font-bold mt-1.5">vs last week ↑ 1</p>
                </div>
                <div className="h-9 flex items-center mt-0.5">
                  <svg className="w-12 h-7 text-[#EB5A1E]" viewBox="0 0 48 28" fill="none">
                    <path d="M4 20 C12 22, 20 9, 30 13 C38 16, 42 7, 44 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-[#EBEBEB]/60 text-[11px] text-[#EB5A1E] font-bold">
                See Details →
              </div>
            </div>

            {/* Attendance */}
            <div className="px-5 py-4 cursor-pointer hover:bg-[#F6F5F3]/50 transition-colors group" onClick={() => navigate("/attendance")}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold text-[#8B8B92] uppercase tracking-wider">Today's Attendance ⓘ</p>
                  <p className="text-[30px] font-black text-[#17171A] mt-1.5 leading-none">
                    {stats?.todayClockedIn ?? 0}
                    <span className="text-sm font-normal text-[#8B8B92]">/{stats?.activeEmployees ?? 99}</span>
                  </p>
                  <p className="text-[11px] text-[#8B8B92] font-semibold mt-1.5">vs yesterday - 0%</p>
                </div>
                <div className="relative w-8 h-8 mt-0.5">
                  <svg className="w-8 h-8 -rotate-90">
                    <circle cx="16" cy="16" r="13" stroke="#F3E9E3" strokeWidth="3" fill="none" />
                    <circle cx="16" cy="16" r="13" stroke="#EB5A1E" strokeWidth="3" strokeDasharray="81.7" strokeDashoffset={81.7 - (81.7 * Math.max(5, attendanceRatio)) / 100} strokeLinecap="round" className="fill-none transition-all duration-700" />
                  </svg>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-[#EBEBEB]/60 text-[11px] text-[#EB5A1E] font-bold">
                See Details →
              </div>
            </div>

            {/* Pending Leave */}
            <div className="px-5 py-4 cursor-pointer hover:bg-[#F6F5F3]/50 transition-colors group" onClick={() => navigate("/leave/requests")}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold text-[#8B8B92] uppercase tracking-wider">Pending Leave ⓘ</p>
                  <p className="text-[30px] font-black text-[#17171A] mt-1.5 leading-none">{stats?.pendingLeaves ?? "0"}</p>
                  <p className="text-[11px] text-[#EB5A1E] font-bold mt-1.5">vs last week ↓ 3</p>
                </div>
                <div className="flex items-end gap-1 h-9 mt-0.5 opacity-90">
                  <div className="w-1.5 h-7 bg-[#EB5A1E] rounded-sm" />
                  <div className="w-1.5 h-3.5 bg-[#EB5A1E]/30 rounded-sm" />
                  <div className="w-1.5 h-5.5 bg-[#EB5A1E]/60 rounded-sm" />
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-[#EBEBEB]/60 text-[11px] text-[#EB5A1E] font-bold">
                See Details →
              </div>
            </div>
          </div>
        </div>

        {/* ── ROW 2: Attendance Score (narrow ~20%) + Attendance Trend (wide ~80%) ── */}
        <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: "205px 1fr" }}>
          {/* Attendance Score — narrow vertical card */}
          <Card className="p-4 rounded-2xl border-[#EBEBEB] bg-white shadow-2xs flex flex-col justify-between">
            <div>
              <p className="text-[10px] font-bold text-[#8B8B92] uppercase tracking-widest mb-3">Attendance Score ⓘ</p>

              {/* Gauge Arc */}
              <div className="flex flex-col items-center relative" style={{ height: "100px" }}>
                <svg viewBox="0 0 160 88" className="w-full" style={{ maxWidth: "160px" }}>
                  {/* Track arc */}
                  <path d="M 16 80 A 64 64 0 0 1 144 80" fill="none" stroke="#F3E9E3" strokeWidth="13" strokeLinecap="round" />
                  {/* Value arc */}
                  <path d="M 16 80 A 64 64 0 0 1 144 80" fill="none" stroke="#EB5A1E" strokeWidth="13" strokeLinecap="round"
                    strokeDasharray="201"
                    strokeDashoffset={201 * (1 - displayAttendanceScore / 100)}
                    style={{ transition: "stroke-dashoffset 1s ease-out" }}
                  />
                </svg>
                {/* Score overlay */}
                <div className="absolute flex flex-col items-center" style={{ bottom: "4px" }}>
                  <div className="flex items-center gap-1">
                    <span className="text-[28px] font-black text-[#17171A] leading-none">{displayAttendanceScore}</span>
                    <span className="text-[9px] font-bold text-[#027A48] bg-[#D1FADF] border border-[#A6F4C5] px-1 py-0.5 rounded-full leading-none">+1</span>
                  </div>
                  <span className="text-[10px] text-[#8B8B92] font-medium mt-0.5 leading-none">of 100 points</span>
                </div>
              </div>

              {/* Info box */}
              <div className="bg-[#F6F5F3] border border-[#EBEBEB]/70 rounded-xl p-3 mt-3">
                <p className="font-bold text-[#17171A] text-[11px]">Great attendance this week ✓</p>
                <p className="text-[#8B8B92] mt-1 leading-relaxed text-[10px]">
                  Attendance is trending above target with only 1 late log across the whole team this week.
                </p>
              </div>
            </div>

            <button onClick={() => navigate("/attendance")} className="mt-3 text-[11px] font-bold text-[#EB5A1E] hover:underline text-left">
              Improve Score →
            </button>
          </Card>

          {/* Attendance Trend — wide card */}
          <Card className="p-5 rounded-2xl border-[#EBEBEB] bg-white shadow-2xs flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold text-[#8B8B92] uppercase tracking-widest">Attendance Trend ⓘ</p>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" className="h-6 text-[10px] font-semibold rounded-lg bg-white border-[#EBEBEB] gap-1 px-2">
                  <Filter className="h-2.5 w-2.5 text-[#8B8B92]" /> Filter
                </Button>
                <Button variant="outline" size="sm" className="h-6 text-[10px] font-semibold rounded-lg bg-white border-[#EBEBEB] gap-1 px-2">
                  This Year <ChevronDown className="h-2.5 w-2.5 text-[#8B8B92]" />
                </Button>
              </div>
            </div>

            {/* Chart area with Y-axis + bars */}
            <div className="flex-1 flex gap-3" style={{ minHeight: "180px" }}>
              {/* Y-axis */}
              <div className="flex flex-col justify-between text-[9px] text-[#8B8B92]/70 font-medium pb-6 select-none shrink-0 w-7 text-right">
                <span>100%</span>
                <span>75%</span>
                <span>50%</span>
                <span>25%</span>
                <span>0</span>
              </div>

              {/* Bars */}
              <div className="flex-1 relative">
                {/* Tooltip over Jun */}
                <div className="absolute -top-1 left-[50.5%] -translate-x-1/2 z-20">
                  <div className="bg-[#17171A] text-white text-[9px] py-1.5 px-2.5 rounded-lg shadow-xl flex flex-col items-start gap-0.5 relative">
                    <span className="font-bold text-[10px]">Jun, 2026</span>
                    <div className="flex items-center gap-2 text-white/80">
                      <span>Attendance <span className="font-bold text-white">96%</span></span>
                      <span>Late logs <span className="font-bold text-white">1</span></span>
                    </div>
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#17171A] rotate-45" />
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-1.5 h-full items-end pb-5 border-b border-[#EBEBEB]/60">
                  {[
                    { month: "Jan", val: 65 },
                    { month: "Feb", val: 70 },
                    { month: "Mar", val: 62 },
                    { month: "Apr", val: 76 },
                    { month: "May", val: 80 },
                    { month: "Jun", val: 96, active: true },
                    { month: "Jul", val: 72 },
                    { month: "Aug", val: 68 },
                    { month: "Sept", val: 75 },
                    { month: "Okt", val: 71 },
                    { month: "Nov", val: 74 },
                    { month: "Dec", val: 78 },
                  ].map((item) => (
                    <div key={item.month} className="flex flex-col items-center h-full justify-end">
                      <div
                        className="w-full rounded-t-[4px] transition-all duration-300"
                        style={{
                          height: `${item.val}%`,
                          backgroundColor: item.active ? "#EB5A1E" : "#F3E9E3",
                        }}
                      />
                      <span className={`text-[9px] mt-1.5 font-medium ${item.active ? "text-[#17171A] font-bold" : "text-[#8B8B92]"}`}>
                        {item.month}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* ── ROW 3: Daily Logs Heatmap (wide ~60%) + Workforce Split (narrow ~40%) ── */}
        <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: "1fr 280px" }}>
          {/* Daily Logs Heatmap */}
          <Card className="p-5 rounded-2xl border-[#EBEBEB] bg-white shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-bold text-[#8B8B92] uppercase tracking-widest">Daily Logs Activity</p>
              <div className="flex items-center gap-1.5 text-[9px] text-[#8B8B92] font-bold">
                <span>Low</span>
                <div className="w-4 h-3 rounded-[3px]" style={{ backgroundColor: "#F3E9E3" }} />
                <div className="w-4 h-3 rounded-[3px]" style={{ backgroundColor: "#F19257" }} />
                <div className="w-4 h-3 rounded-[3px]" style={{ backgroundColor: "#EB5A1E" }} />
                <span>High</span>
              </div>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-8 gap-2 mb-2">
              <div />
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
                <div key={d} className="text-center text-[10px] font-bold text-[#8B8B92]">{d}</div>
              ))}
            </div>

            {/* Heatmap rows */}
            <div className="space-y-2">
              {[
                { time: "12 AM - 8 AM", blocks: ["#EB5A1E", "#F3E9E3", "#F3E9E3", "#F19257", "#F3E9E3", "#F3E9E3", "#F3E9E3"] },
                { time: "8 AM - 4 PM",  blocks: ["#EB5A1E", "#F3E9E3", "#EB5A1E", "#EB5A1E", "#F3E9E3", "#EB5A1E", "#F19257"] },
                { time: "4 PM - 12 AM", blocks: ["#F3E9E3", "#F19257", "#F3E9E3", "#F3E9E3", "#F19257", "#F3E9E3", "#EB5A1E"] },
              ].map((row, rIdx) => (
                <div key={rIdx} className="grid grid-cols-8 gap-2 items-center">
                  <span className="text-[9px] font-medium text-[#8B8B92] whitespace-nowrap">{row.time}</span>
                  {row.blocks.map((bg, cIdx) => (
                    <div
                      key={cIdx}
                      className="h-8 rounded-[6px] cursor-pointer hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: bg }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </Card>

          {/* Workforce Split */}
          <Card className="p-5 rounded-2xl border-[#EBEBEB] bg-white shadow-2xs flex flex-col justify-between">
            <div>
              <p className="text-[10px] font-bold text-[#8B8B92] uppercase tracking-widest mb-2">Workforce Split ⓘ</p>
              <p className="text-[30px] font-black text-[#17171A] leading-none">{stats?.activeEmployees ?? "99"}</p>
              <p className="text-[11px] text-[#027A48] font-bold mt-1">Total employees ↑ 8.5%</p>

              {/* Donut */}
              <div className="flex justify-center my-4">
                <svg viewBox="0 0 100 100" className="w-28 h-28 -rotate-90">
                  <circle cx="50" cy="50" r="34" stroke="#F3E9E3" strokeWidth="16" fill="none" />
                  <circle
                    cx="50" cy="50" r="34"
                    stroke="#EB5A1E" strokeWidth="16" fill="none"
                    strokeDasharray="213.6"
                    strokeDashoffset={213.6 * (1 - (onsiteCount > 0 ? onsiteRatio : 0.67))}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dashoffset 1s ease-out" }}
                  />
                </svg>
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-2 pt-3 border-t border-[#EBEBEB]/60">
              <div className="flex items-center justify-between text-[11px] font-semibold text-[#17171A]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#EB5A1E]" />
                  <span>On-site</span>
                </div>
                <span className="font-bold">{donutOnsite}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-[#17171A]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full border-2 border-[#F3E9E3]" style={{ backgroundColor: "#F5EDE6" }} />
                  <span>Remote</span>
                </div>
                <span className="font-bold">{donutRemote}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* ── ROW 4: Recent Activity (full width, compact) ── */}
        <Card className="p-5 rounded-2xl border-[#EBEBEB] bg-white shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-bold text-[#17171A] uppercase tracking-widest">Recent Activity</p>
            <button onClick={() => navigate("/audit")} className="text-[11px] font-bold text-[#EB5A1E] hover:underline">View All →</button>
          </div>
          <div className="divide-y divide-[#EBEBEB]/60">
            {activityItems.map((a) => {
              const colorClass = getAvatarColor(a.initials);
              return (
                <div key={a.id} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-6 h-6 rounded-full font-bold flex items-center justify-center text-[9px] shrink-0 ${colorClass}`}>
                      {a.initials}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-bold text-[#17171A]">{a.name}</span>
                      <span className="text-[11px] text-[#8B8B92]">{a.action}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-[#8B8B92] font-medium shrink-0 ml-4">
                    {a.time}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

      </div>
    );
  }

  // ——— CLIENT DASHBOARD ———
  if (isClient) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>`;

const idx = code.indexOf(targetStr);
const endIdx = code.indexOf(clientDashStr);

if (idx !== -1 && endIdx !== -1) {
  const newCode = code.slice(0, idx) + adminJSX + code.slice(endIdx + clientDashStr.length);
  fs.writeFileSync(filePath, newCode, 'utf8');
  console.log('Successfully patched Dashboard.tsx!');
} else {
  console.log('Could not find markers:', { idx, endIdx });
}
