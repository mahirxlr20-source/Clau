// What Premium unlocks. Change these lists to move features between Free and Premium.
//
// Free:    Home, the Degree map, CGPA and its what-ifs, Rules, More (backup, sources),
//          for every planner.
// Premium: the working tools - Money (bill and fee-date countdowns), Semester (tasks,
//          routine, semester pages) and Toolkit (logs and calculators) - plus the Excel
//          tracker download and printing.

export const PREMIUM_TABS = ['money', 'semester', 'toolkit'] as const;
export const PREMIUM_FEATURES = ['tracker', 'print'] as const;

export const isPremiumTab = (tab: string) => (PREMIUM_TABS as readonly string[]).includes(tab);
