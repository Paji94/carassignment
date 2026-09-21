import { useState, type ChangeEvent } from "react";

type Role = "coach" | "parent" | "player";
type DriverRole = "coach" | "parent";
type Tab = "setup" | "drive" | "result";

interface Member {
  id: number;
  name: string;
  role: Role;
}

interface CarDefinition {
  carName: string;
  driverName: string;
  driverRole: DriverRole;
  capacity: number;
  isBaggageCar: boolean;
}

interface AssignedCar extends CarDefinition {
  driver: Member;
  passengers: Member[];
  hasParent: boolean;
}

interface CarCandidate extends CarDefinition {
  driver: Member | undefined;
  passengers: Member[];
  hasParent: boolean;
}

const initialMembers: Member[] = [
  { id: 1, name: "北島監督", role: "coach" },
  { id: 2, name: "太田", role: "coach" },
  { id: 3, name: "菅原", role: "coach" },
  { id: 4, name: "正田", role: "coach" },
  { id: 5, name: "竹内", role: "coach" },
  { id: 6, name: "田中", role: "coach" },
  { id: 7, name: "田村", role: "coach" },
  { id: 8, name: "森", role: "coach" },
  { id: 9, name: "阿部", role: "parent" },
  { id: 10, name: "新井", role: "parent" },
  { id: 11, name: "榎本", role: "parent" },
  { id: 12, name: "大林", role: "parent" },
  { id: 13, name: "太田", role: "parent" },
  { id: 14, name: "北島", role: "parent" },
  { id: 15, name: "正田", role: "parent" },
  { id: 16, name: "竹内", role: "parent" },
  { id: 17, name: "田中", role: "parent" },
  { id: 18, name: "田村", role: "parent" },
  { id: 19, name: "街風", role: "parent" },
  { id: 20, name: "阿部", role: "player" },
  { id: 21, name: "新井", role: "player" },
  { id: 22, name: "榎本", role: "player" },
  { id: 23, name: "大林", role: "player" },
  { id: 24, name: "太田", role: "player" },
  { id: 25, name: "北島", role: "player" },
  { id: 26, name: "正田", role: "player" },
  { id: 27, name: "田中", role: "player" },
  { id: 28, name: "田村", role: "player" },
  { id: 29, name: "街風", role: "player" },
  { id: 30, name: "森", role: "player" },
];

const CAR_DEFINITIONS: CarDefinition[] = [
  { carName: "北島号", driverName: "北島監督", driverRole: "coach", capacity: 3, isBaggageCar: false },
  { carName: "太田号", driverName: "太田", driverRole: "coach", capacity: 3, isBaggageCar: false },
  { carName: "菅原号", driverName: "菅原", driverRole: "coach", capacity: 5, isBaggageCar: true },
  { carName: "田中号", driverName: "田中", driverRole: "coach", capacity: 3, isBaggageCar: true },
];

const roleLabel: Record<Role, string> = { coach: "コーチ", parent: "ママーズ", player: "選手" };

// ロールごとの配色はTailwindのJITスキャナがビルド時にクラス名を検出できるよう、
// 動的なテンプレート文字列ではなく静的なクラス名の一覧として定義する。
const ROLE_CLASSES: Record<Role, {
  sectionText: string;
  rowActiveBg: string;
  rowActiveBorder: string;
  checkboxBorderActive: string;
  checkboxBgActive: string;
}> = {
  coach: {
    sectionText: "text-[#7ec8e3]",
    rowActiveBg: "bg-[#1a3a5ccc]",
    rowActiveBorder: "border-[#7ec8e366]",
    checkboxBorderActive: "border-[#7ec8e3]",
    checkboxBgActive: "bg-[#7ec8e3]",
  },
  parent: {
    sectionText: "text-[#a8d85c]",
    rowActiveBg: "bg-[#2d4a1ecc]",
    rowActiveBorder: "border-[#a8d85c66]",
    checkboxBorderActive: "border-[#a8d85c]",
    checkboxBgActive: "bg-[#a8d85c]",
  },
  player: {
    sectionText: "text-[#e38a7e]",
    rowActiveBg: "bg-[#4a1a1acc]",
    rowActiveBorder: "border-[#e38a7e66]",
    checkboxBorderActive: "border-[#e38a7e]",
    checkboxBgActive: "bg-[#e38a7e]",
  },
};

function assignCars(activeCars: CarDefinition[], attendees: Member[]): AssignedCar[] {
  if (activeCars.length === 0) return [];

  const cars: AssignedCar[] = activeCars.map((carDef): CarCandidate => {
    const driver = attendees.find(
      (a) => a.name === carDef.driverName && a.role === carDef.driverRole
    );
    return { ...carDef, driver, passengers: [], hasParent: false };
  }).filter((c): c is AssignedCar => !!c.driver);

  const driverIds = new Set(cars.map((c) => c.driver.id));
  const nonDrivers = attendees.filter((a) => !driverIds.has(a.id));
  const assigned = new Set<number>();

  // 同姓グループを作成
  const nameGroups: Record<string, Member[]> = {};
  for (const person of nonDrivers) {
    if (!nameGroups[person.name]) nameGroups[person.name] = [];
    nameGroups[person.name].push(person);
  }

  // 同姓のドライバーがいる場合、そのドライバーの車に同姓メンバーを優先配置
  for (const car of cars) {
    const sameNameMembers = (nameGroups[car.driver.name] || []).filter(p => !assigned.has(p.id));
    for (const p of sameNameMembers) {
      if (car.passengers.length < car.capacity - 1) {
        car.passengers.push(p);
        if (p.role === "parent") car.hasParent = true;
        assigned.add(p.id);
      }
    }
  }

  // ドライバーのいない同姓グループ（複数人）を同じ車にまとめる
  for (const [, group] of Object.entries(nameGroups)) {
    const unassigned = group.filter(p => !assigned.has(p.id));
    if (unassigned.length < 2) continue;
    const targetCar = cars.find(c => c.passengers.length + unassigned.length <= c.capacity - 1)
      || cars.find(c => c.passengers.length < c.capacity - 1);
    if (!targetCar) continue;
    for (const p of unassigned) {
      if (targetCar.passengers.length < targetCar.capacity - 1) {
        targetCar.passengers.push(p);
        if (p.role === "parent") targetCar.hasParent = true;
        assigned.add(p.id);
      }
    }
  }

  // 未割り当て保護者・コーチを各車に1人ずつ補完
  const remainingParents = nonDrivers.filter(
    (a) => !assigned.has(a.id) && (a.role === "parent" || a.role === "coach")
  );
  for (const car of cars) {
    if (!car.hasParent && remainingParents.length > 0 && car.passengers.length < car.capacity - 1) {
      const p = remainingParents.shift();
      if (!p) continue;
      car.passengers.push(p);
      car.hasParent = true;
      assigned.add(p.id);
    }
  }
  for (const p of remainingParents) {
    const available = cars.filter((c) => c.passengers.length < c.capacity - 1);
    if (available.length > 0) { available[0].passengers.push(p); assigned.add(p.id); }
  }

  // 未割り当て選手を均等配置
  const remainingPlayers = nonDrivers.filter(
    (a) => !assigned.has(a.id) && a.role === "player"
  );
  let idx = 0;
  while (remainingPlayers.length > 0) {
    const car = cars[idx % cars.length];
    if (car.passengers.length < car.capacity - 1) {
      const nextPlayer = remainingPlayers.shift();
      if (nextPlayer) car.passengers.push(nextPlayer);
    }
    idx++;
    if (idx > cars.length * 100) break;
  }

  return cars;
}

export default function App() {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [attending, setAttending] = useState<Record<number, boolean>>({});
  const [carDefs, setCarDefs] = useState<CarDefinition[]>(CAR_DEFINITIONS);
  const [activeCars, setActiveCars] = useState<Record<string, boolean>>(
    CAR_DEFINITIONS.reduce((acc, c) => ({ ...acc, [c.carName]: true }), {} as Record<string, boolean>)
  );
  const [result, setResult] = useState<AssignedCar[] | null>(null);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<Role>("player");
  const [tab, setTab] = useState<Tab>("setup");
  const [newCarName, setNewCarName] = useState("");
  const [newCarDriver, setNewCarDriver] = useState("");
  const [newCarDriverRole, setNewCarDriverRole] = useState<DriverRole>("coach");
  const [newCarCapacity, setNewCarCapacity] = useState(4);
  const [newCarIsBaggage, setNewCarIsBaggage] = useState(false);

  const toggleAttend = (id: number) => setAttending((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleCar = (carName: string) => setActiveCars((prev) => ({ ...prev, [carName]: !prev[carName] }));

  const addCar = () => {
    if (!newCarName.trim() || !newCarDriver.trim()) return;
    const newCar: CarDefinition = { carName: newCarName.trim(), driverName: newCarDriver.trim(), driverRole: newCarDriverRole, capacity: newCarCapacity, isBaggageCar: newCarIsBaggage };
    setCarDefs((prev) => [...prev, newCar]);
    setActiveCars((prev) => ({ ...prev, [newCar.carName]: true }));
    setNewCarName(""); setNewCarDriver(""); setNewCarCapacity(4); setNewCarIsBaggage(false);
  };

  const removeCar = (carName: string) => {
    setCarDefs((prev) => prev.filter((c) => c.carName !== carName));
    setActiveCars((prev) => { const n = { ...prev }; delete n[carName]; return n; });
  };

  const attendees = members.filter((m) => attending[m.id]);
  const selectedCars = carDefs.filter((c) => activeCars[c.carName]);
  const availableCars = selectedCars.filter((c) =>
    attendees.find((a) => a.name === c.driverName && a.role === c.driverRole)
  );

  const handleGenerate = () => { setResult(assignCars(availableCars, attendees)); setTab("result"); };

  const addMember = () => {
    if (!newName.trim()) return;
    setMembers((prev) => [...prev, { id: Date.now(), name: newName.trim(), role: newRole }]);
    setNewName("");
  };

  const removeMember = (id: number) => {
    setMembers((prev) => prev.filter((m) => m.id !== id));
    setAttending((prev) => { const n = { ...prev }; delete n[id]; return n; });
  };

  const totalSeats = availableCars.reduce((s, c) => s + (c.capacity - 1), 0);
  const driverIds = new Set(availableCars.map((c) => attendees.find((a) => a.name === c.driverName && a.role === c.driverRole)?.id).filter(Boolean));
  const nonDriverCount = attendees.filter((a) => !driverIds.has(a.id)).length;
  const seatOk = totalSeats >= nonDriverCount;
  const baggageCarOk = availableCars.some((c) => c.isBaggageCar);
  const canGenerate = availableCars.length > 0 && seatOk && baggageCarOk;

  const removeButtonClass = "cursor-pointer border-none bg-transparent px-1 text-[16px] text-[#556677]";
  const textFieldClass = "rounded-lg border border-white/20 bg-white/[0.08] py-2 px-3 text-[13px] text-[#e8dcc8]";
  const selectFieldClass = "rounded-lg border border-white/20 bg-[#1a3a5c] py-2 px-2.5 text-[13px] text-[#e8dcc8]";

  return (
    <div className="min-h-screen bg-[#0d1b2a] font-serif text-[#e8dcc8]">

      {/* ロゴバナー */}
      <div className="relative overflow-hidden bg-[linear-gradient(180deg,#0a0f1a_0%,#0d1f35_60%,#0d2a4a_100%)] px-4 pt-3 pb-2.5 text-center">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_120%,#ff6b00_0%,#c8a84b_40%,transparent_70%)] opacity-[0.07]" />
        <svg viewBox="0 0 210 55" className="mx-auto block w-full max-w-[210px]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="goldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffe680" />
              <stop offset="40%" stopColor="#c8a84b" />
              <stop offset="100%" stopColor="#8a6a1a" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
              <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="softglow">
              <feGaussianBlur stdDeviation="0.8" result="coloredBlur"/>
              <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          <line x1="10" y1="21" x2="62" y2="21" stroke="url(#goldGrad)" strokeWidth="0.5" opacity="0.5" />
          <line x1="148" y1="21" x2="200" y2="21" stroke="url(#goldGrad)" strokeWidth="0.5" opacity="0.5" />
          <polygon points="65,18.5 68,21 65,23.5 62,21" fill="#c8a84b" opacity="0.7" />
          <polygon points="145,18.5 148,21 145,23.5 142,21" fill="#c8a84b" opacity="0.7" />
          <text x="105" y="14" textAnchor="middle" fontFamily="'Palatino Linotype', 'Book Antiqua', Palatino, serif" fontSize="8" fontStyle="italic" letterSpacing="4" fill="url(#goldGrad)" opacity="0.9">Setagaya</text>
          <text x="105" y="34" textAnchor="middle" fontFamily="'Palatino Linotype', 'Book Antiqua', Palatino, serif" fontSize="22" fontWeight="bold" fontStyle="italic" letterSpacing="4" fill="#e8dcc8" filter="url(#glow)">Phoenix</text>
          <circle cx="90" cy="40" r="0.8" fill="#c8a84b" opacity="0.7" />
          <circle cx="105" cy="40" r="0.8" fill="#c8a84b" opacity="0.7" />
          <circle cx="120" cy="40" r="0.8" fill="#c8a84b" opacity="0.7" />
          <text x="105" y="50" textAnchor="middle" fontFamily="'Palatino Linotype', 'Book Antiqua', Palatino, serif" fontSize="6" fontStyle="italic" letterSpacing="4" fill="#7ec8e3" opacity="0.9">Tokyo</text>
        </svg>
      </div>

      {/* ヘッダー */}
      <div className="sticky top-0 z-[100] border-b-[3px] border-[#c8a84b] bg-gradient-to-br from-[#1a3a5c] to-[#0d2137] pt-3.5 px-6 pb-4">
        <div className="mb-3.5 flex items-center gap-3">
          <span className="text-[22px]">⚾</span>
          <div className="text-[15px] font-bold tracking-[1px] text-[#c8a84b]">船橋フェニックスホワイトチーム　配車アプリ</div>
        </div>
        <div className="flex gap-2">
          {(["setup", "drive", "result"] as const).map((t) => {
            const labels: Record<Tab, string> = { setup: "① 参加選択", drive: "② 車・ドライバー", result: "③ 配車結果" };
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`cursor-pointer rounded-[20px] border-none py-1.5 px-3.5 text-[12px] font-bold transition-all duration-200 ${
                  tab === t ? "bg-[#c8a84b] text-[#0d1b2a]" : "bg-white/10 text-[#e8dcc8]"
                }`}
              >
                {labels[t]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mx-auto max-w-[600px] p-4">

        {/* ① 参加選択タブ */}
        {tab === "setup" && (
          <div>
            <div className="mb-4 rounded-[10px] border border-[#c8a84b]/30 bg-[#c8a84b]/10 py-3 px-4 text-[13px] text-[#c8a84b]">
              選手車で移動するメンバーにチェックを入れてください
            </div>
            {(["coach", "parent", "player"] as const).map((role) => {
              const group = members.filter((m) => m.role === role);
              return (
                <div key={role} className="mb-4">
                  <div className={`mb-2 text-[12px] font-bold uppercase tracking-[2px] ${ROLE_CLASSES[role].sectionText}`}>
                    {roleLabel[role]} ({group.filter(m => attending[m.id]).length}/{group.length})
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {group.map((m) => (
                      <div
                        key={m.id}
                        className={`flex cursor-pointer items-center justify-between rounded-[10px] border py-2.5 px-3.5 transition-all duration-200 ${
                          attending[m.id]
                            ? `${ROLE_CLASSES[role].rowActiveBg} ${ROLE_CLASSES[role].rowActiveBorder}`
                            : "border-white/[0.08] bg-white/[0.04]"
                        }`}
                        onClick={() => toggleAttend(m.id)}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border-2 text-[13px] text-[#0d1b2a] ${
                              attending[m.id]
                                ? `${ROLE_CLASSES[role].checkboxBorderActive} ${ROLE_CLASSES[role].checkboxBgActive}`
                                : "border-white/30 bg-transparent"
                            }`}
                          >
                            {attending[m.id] ? "✓" : ""}
                          </div>
                          <span className={`text-[14px] ${attending[m.id] ? "text-[#e8dcc8]" : "text-[#8899aa]"}`}>{m.name}</span>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); removeMember(m.id); }} className={removeButtonClass}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* メンバー追加 */}
            <div className="mt-5 rounded-xl border border-dashed border-white/[0.15] bg-white/[0.04] p-4">
              <div className="mb-2.5 text-[12px] font-bold text-[#7ec8e3]">＋ メンバーを追加</div>
              <div className="flex flex-wrap gap-2">
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="名前を入力"
                  className={`min-w-[120px] flex-1 ${textFieldClass}`} />
                <select value={newRole} onChange={(e: ChangeEvent<HTMLSelectElement>) => setNewRole(e.target.value as Role)}
                  className={selectFieldClass}>
                  <option value="coach">コーチ</option>
                  <option value="parent">ママーズ</option>
                  <option value="player">選手</option>
                </select>
                <button onClick={addMember} className="cursor-pointer rounded-lg border-none bg-[#c8a84b] py-2 px-4 text-[13px] font-bold text-[#0d1b2a]">追加</button>
              </div>
            </div>

            <button
              onClick={() => setTab("drive")}
              disabled={attendees.length === 0}
              className={`mt-5 w-full rounded-xl border-none p-3.5 text-[15px] font-bold ${
                attendees.length > 0
                  ? "cursor-pointer bg-gradient-to-br from-[#c8a84b] to-[#e8c86b] text-[#0d1b2a]"
                  : "cursor-not-allowed bg-white/10 text-[#556677]"
              }`}
            >
              次へ：車・ドライバーを選択 →
            </button>
          </div>
        )}

        {/* ② 車選択タブ */}
        {tab === "drive" && (
          <div>
            <div className="mb-4 rounded-[10px] border border-[#7ec8e3]/30 bg-[#7ec8e3]/10 py-3 px-4 text-[13px] text-[#7ec8e3]">
              今日使う車にチェックを入れてください。ドライバーが参加している場合のみ有効になります。
            </div>
            <div className="mb-4 flex flex-col gap-2.5">
              {carDefs.map((carDef) => {
                const isChecked = activeCars[carDef.carName];
                const isAvailable = !!attendees.find((a) => a.name === carDef.driverName && a.role === carDef.driverRole);
                return (
                  <div
                    key={carDef.carName}
                    className={`rounded-xl border py-3.5 px-4 ${
                      isChecked && isAvailable ? "border-[#7ec8e366] bg-[#7ec8e3]/[0.12]" : "border-white/[0.08] bg-white/[0.04]"
                    } ${isAvailable ? "opacity-100" : "opacity-[0.45]"}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex flex-1 cursor-pointer items-center gap-2.5" onClick={() => isAvailable && toggleCar(carDef.carName)}>
                        <div
                          className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border-2 text-[13px] text-[#0d1b2a] ${
                            isChecked && isAvailable ? "border-[#7ec8e3] bg-[#7ec8e3]" : "border-white/30 bg-transparent"
                          }`}
                        >
                          {isChecked && isAvailable ? "✓" : ""}
                        </div>
                        <div>
                          <div className={`text-[15px] font-bold ${isChecked && isAvailable ? "text-[#e8dcc8]" : "text-[#8899aa]"}`}>🚗 {carDef.carName}</div>
                          <div className="mt-0.5 text-[11px] text-[#7ec8e3]">
                            運転手：{carDef.driverName}（{carDef.driverRole === "coach" ? "コーチ" : "ママーズ"}）　定員：{carDef.capacity}人
                            {carDef.isBaggageCar && <span className="ml-2 text-[#c8a84b]">🎒 荷物車</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!isAvailable && <span className="text-[11px] text-[#e38a7e]">未参加</span>}
                        <button onClick={(e) => { e.stopPropagation(); removeCar(carDef.carName); }} className={removeButtonClass}>×</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 車追加フォーム */}
            <div className="mb-5 rounded-xl border border-dashed border-white/[0.15] bg-white/[0.04] p-4">
              <div className="mb-3 text-[12px] font-bold text-[#7ec8e3]">＋ 車・ドライバーを追加</div>
              <div className="flex flex-col gap-2.5">
                <input value={newCarName} onChange={(e) => setNewCarName(e.target.value)} placeholder="車の名前（例：山田号）"
                  className={textFieldClass} />
                <div className="flex gap-2">
                  <input value={newCarDriver} onChange={(e) => setNewCarDriver(e.target.value)} placeholder="運転手の名前"
                    className={`flex-1 ${textFieldClass}`} />
                  <select value={newCarDriverRole} onChange={(e: ChangeEvent<HTMLSelectElement>) => setNewCarDriverRole(e.target.value as DriverRole)}
                    className={selectFieldClass}>
                    <option value="coach">コーチ</option>
                    <option value="parent">ママーズ</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="whitespace-nowrap text-[13px] text-[#c8a84b]">🚗 乗車人数（運転手含む）</span>
                  <select value={newCarCapacity} onChange={(e) => setNewCarCapacity(parseInt(e.target.value))}
                    className={selectFieldClass}>
                    {[2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}人</option>)}
                  </select>
                </div>
                <div className="flex cursor-pointer items-center gap-2.5" onClick={() => setNewCarIsBaggage(!newCarIsBaggage)}>
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-[5px] border-2 text-[12px] text-[#0d1b2a] ${
                      newCarIsBaggage ? "border-[#c8a84b] bg-[#c8a84b]" : "border-white/30 bg-transparent"
                    }`}
                  >
                    {newCarIsBaggage ? "✓" : ""}
                  </div>
                  <span className="text-[13px] text-[#e8dcc8]">🎒 荷物車にする</span>
                </div>
                <button
                  onClick={addCar}
                  disabled={!newCarName.trim() || !newCarDriver.trim()}
                  className={`rounded-lg border-none p-2.5 text-[13px] font-bold ${
                    newCarName.trim() && newCarDriver.trim()
                      ? "cursor-pointer bg-[#c8a84b] text-[#0d1b2a]"
                      : "cursor-not-allowed bg-white/10 text-[#556677]"
                  }`}
                >追加する</button>
              </div>
            </div>

            {/* 座席サマリー */}
            {availableCars.length > 0 && (
              <div className="mb-4 flex flex-col gap-2">
                <div className={`rounded-[10px] border py-3 px-4 ${seatOk ? "border-[#a8d85c66] bg-[#a8d85c]/10" : "border-[#e38a7e66] bg-[#e38a7e]/10"}`}>
                  <div className={`text-[13px] ${seatOk ? "text-[#a8d85c]" : "text-[#e38a7e]"}`}>
                    {seatOk ? "✓" : "⚠️"} 車 {availableCars.length}台 ／ 空き座席 {totalSeats}席 ／ 同乗者 {nonDriverCount}人
                    {!seatOk && <div className="mt-1 text-[12px]">座席が足りません。使う車を増やしてください。</div>}
                  </div>
                </div>
                <div className={`rounded-[10px] border py-3 px-4 ${baggageCarOk ? "border-[#a8d85c66] bg-[#a8d85c]/10" : "border-[#e38a7e66] bg-[#e38a7e]/10"}`}>
                  <div className={`text-[13px] ${baggageCarOk ? "text-[#a8d85c]" : "text-[#e38a7e]"}`}>
                    {baggageCarOk ? "✓ 🎒 荷物車あり" : "⚠️ 🎒 荷物車が選択されていません（菅原号または田中号を選択してください）"}
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className={`w-full rounded-xl border-none p-3.5 text-[15px] font-bold ${
                canGenerate
                  ? "cursor-pointer bg-gradient-to-br from-[#7ec8e3] to-[#5ab8d3] text-[#0d1b2a]"
                  : "cursor-not-allowed bg-white/10 text-[#556677]"
              }`}
            >
              ⚾ 配車を自動生成する
            </button>
          </div>
        )}

        {/* ③ 結果タブ */}
        {tab === "result" && (
          <div>
            {!result ? (
              <div className="p-10 text-center text-[#556677]">
                <div className="mb-4 text-[40px]">⚾</div>
                <div>まず車・ドライバーを設定して配車を生成してください</div>
                <button onClick={() => setTab("drive")} className="mt-4 cursor-pointer rounded-[20px] border-none bg-[#c8a84b] py-2.5 px-6 text-[13px] font-bold text-[#0d1b2a]">車・ドライバー設定へ</button>
              </div>
            ) : (
              <div>
                <div className="mb-4 rounded-[10px] border border-[#c8a84b]/30 bg-[#c8a84b]/10 py-3 px-4 text-[13px] text-[#c8a84b]">
                  ✓ 配車が完了しました！参加者 {attendees.length}人 ／ {result.length}台
                </div>
                {result.map((car, i) => (
                  <div key={i} className="mb-3.5 overflow-hidden rounded-[14px] border border-[#c8a84b]/30 bg-white/[0.03]">
                    <div className="flex items-center gap-2.5 border-b border-[#c8a84b]/30 bg-gradient-to-br from-[#1a3a5c] to-[#0d2137] py-3 px-4">
                      <span className="text-[20px]">🚗</span>
                      <div>
                        <div className="text-[15px] font-bold text-[#c8a84b]">
                          {car.carName}
                          {car.isBaggageCar && <span className="ml-2 text-[12px]">🎒 荷物車</span>}
                        </div>
                        <div className="text-[11px] text-[#7ec8e3]">
                          定員{car.capacity}人 ／ 乗車{car.passengers.length + 1}人
                          {car.hasParent && <span className="ml-2 text-[#a8d85c]">✓ ママーズ同乗</span>}
                        </div>
                      </div>
                    </div>
                    <div className="py-3 px-4">
                      <div className="mb-2 flex items-center gap-2 rounded-lg bg-[#7ec8e3]/10 py-2 px-3">
                        <span>🧢</span>
                        <span className="text-[13px] text-[#7ec8e3]">運転手：{car.driver.name}</span>
                        <span className={`ml-auto text-[11px] ${ROLE_CLASSES[car.driver.role].sectionText}`}>{roleLabel[car.driver.role]}</span>
                      </div>
                      {car.passengers.length > 0 ? car.passengers.map((p, j) => (
                        <div key={j} className="mb-1 flex items-center gap-2 rounded-lg bg-white/[0.03] py-[7px] px-3">
                          <span className="text-[12px]">👤</span>
                          <span className="text-[13px] text-[#e8dcc8]">{p.name}</span>
                          <span className={`ml-auto text-[11px] ${ROLE_CLASSES[p.role].sectionText}`}>{roleLabel[p.role]}</span>
                        </div>
                      )) : (
                        <div className="py-1.5 px-3 text-[12px] text-[#556677]">同乗者なし</div>
                      )}
                    </div>
                  </div>
                ))}
                <button onClick={handleGenerate} className="mt-2 w-full cursor-pointer rounded-xl border border-[#c8a84b]/50 bg-transparent p-3 text-[14px] font-bold text-[#c8a84b]">
                  🔄 再配車する（シャッフル）
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
