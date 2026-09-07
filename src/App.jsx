import { useState } from "react";

const initialMembers = [
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

const CAR_DEFINITIONS = [
  { carName: "北島号", driverName: "北島監督", driverRole: "coach", capacity: 3, isBaggageCar: false },
  { carName: "太田号", driverName: "太田", driverRole: "coach", capacity: 3, isBaggageCar: false },
  { carName: "菅原号", driverName: "菅原", driverRole: "coach", capacity: 5, isBaggageCar: true },
  { carName: "田中号", driverName: "田中", driverRole: "coach", capacity: 3, isBaggageCar: true },
];

const roleLabel = { coach: "コーチ", parent: "ママーズ", player: "選手" };
const roleColor = {
  coach: { bg: "#1a3a5c", text: "#7ec8e3" },
  parent: { bg: "#2d4a1e", text: "#a8d85c" },
  player: { bg: "#4a1a1a", text: "#e38a7e" },
};

function assignCars(activeCars, attendees) {
  if (activeCars.length === 0) return [];

  const cars = activeCars.map((carDef) => {
    const driver = attendees.find(
      (a) => a.name === carDef.driverName && a.role === carDef.driverRole
    );
    return { ...carDef, driver, passengers: [], hasParent: false };
  }).filter((c) => c.driver);

  const driverIds = new Set(cars.map((c) => c.driver.id));
  const nonDrivers = attendees.filter((a) => !driverIds.has(a.id));
  const assigned = new Set();

  // 同姓グループを作成
  const nameGroups = {};
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
      car.passengers.push(remainingPlayers.shift());
    }
    idx++;
    if (idx > cars.length * 100) break;
  }

  return cars;
}

export default function App() {
  const [members, setMembers] = useState(initialMembers);
  const [attending, setAttending] = useState({});
  const [carDefs, setCarDefs] = useState(CAR_DEFINITIONS);
  const [activeCars, setActiveCars] = useState(
    CAR_DEFINITIONS.reduce((acc, c) => ({ ...acc, [c.carName]: true }), {})
  );
  const [result, setResult] = useState(null);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("player");
  const [tab, setTab] = useState("setup");
  const [newCarName, setNewCarName] = useState("");
  const [newCarDriver, setNewCarDriver] = useState("");
  const [newCarDriverRole, setNewCarDriverRole] = useState("coach");
  const [newCarCapacity, setNewCarCapacity] = useState(4);
  const [newCarIsBaggage, setNewCarIsBaggage] = useState(false);

  const toggleAttend = (id) => setAttending((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleCar = (carName) => setActiveCars((prev) => ({ ...prev, [carName]: !prev[carName] }));

  const addCar = () => {
    if (!newCarName.trim() || !newCarDriver.trim()) return;
    const newCar = { carName: newCarName.trim(), driverName: newCarDriver.trim(), driverRole: newCarDriverRole, capacity: newCarCapacity, isBaggageCar: newCarIsBaggage };
    setCarDefs((prev) => [...prev, newCar]);
    setActiveCars((prev) => ({ ...prev, [newCar.carName]: true }));
    setNewCarName(""); setNewCarDriver(""); setNewCarCapacity(4); setNewCarIsBaggage(false);
  };

  const removeCar = (carName) => {
    setCarDefs((prev) => prev.filter((c) => c.carName !== carName));
    setActiveCars((prev) => { const n = {...prev}; delete n[carName]; return n; });
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

  const removeMember = (id) => {
    setMembers((prev) => prev.filter((m) => m.id !== id));
    setAttending((prev) => { const n = {...prev}; delete n[id]; return n; });
  };

  const totalSeats = availableCars.reduce((s, c) => s + (c.capacity - 1), 0);
  const driverIds = new Set(availableCars.map((c) => attendees.find((a) => a.name === c.driverName && a.role === c.driverRole)?.id).filter(Boolean));
  const nonDriverCount = attendees.filter((a) => !driverIds.has(a.id)).length;
  const seatOk = totalSeats >= nonDriverCount;
  const baggageCarOk = availableCars.some((c) => c.isBaggageCar);
  const canGenerate = availableCars.length > 0 && seatOk && baggageCarOk;

  return (
    <div style={{ minHeight: "100vh", background: "#0d1b2a", fontFamily: "'Georgia', serif", color: "#e8dcc8", padding: "0" }}>

      {/* ロゴバナー */}
      <div style={{ background: "linear-gradient(180deg, #0a0f1a 0%, #0d1f35 60%, #0d2a4a 100%)", padding: "12px 16px 10px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.07, background: "radial-gradient(ellipse at 50% 120%, #ff6b00 0%, #c8a84b 40%, transparent 70%)", pointerEvents: "none" }} />
        <svg viewBox="0 0 210 55" width="100%" style={{ maxWidth: 210, display: "block", margin: "0 auto" }} xmlns="http://www.w3.org/2000/svg">
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
      <div style={{ background: "linear-gradient(135deg, #1a3a5c 0%, #0d2137 100%)", borderBottom: "3px solid #c8a84b", padding: "14px 24px 16px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <span style={{ fontSize: 22 }}>⚾</span>
          <div style={{ fontSize: 15, fontWeight: "bold", color: "#c8a84b", letterSpacing: 1 }}>船橋フェニックスホワイトチーム　配車アプリ</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["setup", "drive", "result"].map((t) => {
            const labels = { setup: "① 参加選択", drive: "② 車・ドライバー", result: "③ 配車結果" };
            return (
              <button key={t} onClick={() => setTab(t)} style={{ padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: "bold", background: tab === t ? "#c8a84b" : "rgba(255,255,255,0.1)", color: tab === t ? "#0d1b2a" : "#e8dcc8", transition: "all 0.2s" }}>
                {labels[t]}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "16px", maxWidth: 600, margin: "0 auto" }}>

        {/* ① 参加選択タブ */}
        {tab === "setup" && (
          <div>
            <div style={{ marginBottom: 16, padding: "12px 16px", background: "rgba(200,168,75,0.1)", borderRadius: 10, border: "1px solid rgba(200,168,75,0.3)", fontSize: 13, color: "#c8a84b" }}>
              選手車で移動するメンバーにチェックを入れてください
            </div>
            {["coach", "parent", "player"].map((role) => {
              const group = members.filter((m) => m.role === role);
              return (
                <div key={role} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: "bold", color: roleColor[role].text, marginBottom: 8, letterSpacing: 2, textTransform: "uppercase" }}>
                    {roleLabel[role]} ({group.filter(m => attending[m.id]).length}/{group.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {group.map((m) => (
                      <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, background: attending[m.id] ? `${roleColor[role].bg}cc` : "rgba(255,255,255,0.04)", border: `1px solid ${attending[m.id] ? roleColor[role].text + "66" : "rgba(255,255,255,0.08)"}`, cursor: "pointer", transition: "all 0.2s" }} onClick={() => toggleAttend(m.id)}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${attending[m.id] ? roleColor[role].text : "rgba(255,255,255,0.3)"}`, background: attending[m.id] ? roleColor[role].text : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#0d1b2a", flexShrink: 0 }}>
                            {attending[m.id] ? "✓" : ""}
                          </div>
                          <span style={{ fontSize: 14, color: attending[m.id] ? "#e8dcc8" : "#8899aa" }}>{m.name}</span>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); removeMember(m.id); }} style={{ background: "none", border: "none", color: "#556677", cursor: "pointer", fontSize: 16, padding: "0 4px" }}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* メンバー追加 */}
            <div style={{ marginTop: 20, padding: 16, background: "rgba(255,255,255,0.04)", borderRadius: 12, border: "1px dashed rgba(255,255,255,0.15)" }}>
              <div style={{ fontSize: 12, color: "#7ec8e3", marginBottom: 10, fontWeight: "bold" }}>＋ メンバーを追加</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="名前を入力"
                  style={{ flex: 1, minWidth: 120, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "#e8dcc8", fontSize: 13 }} />
                <select value={newRole} onChange={(e) => setNewRole(e.target.value)}
                  style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "#1a3a5c", color: "#e8dcc8", fontSize: 13 }}>
                  <option value="coach">コーチ</option>
                  <option value="parent">ママーズ</option>
                  <option value="player">選手</option>
                </select>
                <button onClick={addMember} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#c8a84b", color: "#0d1b2a", fontSize: 13, fontWeight: "bold", cursor: "pointer" }}>追加</button>
              </div>
            </div>

            <button onClick={() => setTab("drive")} disabled={attendees.length === 0} style={{ width: "100%", marginTop: 20, padding: "14px", borderRadius: 12, border: "none", background: attendees.length > 0 ? "linear-gradient(135deg, #c8a84b, #e8c86b)" : "rgba(255,255,255,0.1)", color: attendees.length > 0 ? "#0d1b2a" : "#556677", fontSize: 15, fontWeight: "bold", cursor: attendees.length > 0 ? "pointer" : "not-allowed" }}>
              次へ：車・ドライバーを選択 →
            </button>
          </div>
        )}

        {/* ② 車選択タブ */}
        {tab === "drive" && (
          <div>
            <div style={{ marginBottom: 16, padding: "12px 16px", background: "rgba(126,200,227,0.1)", borderRadius: 10, border: "1px solid rgba(126,200,227,0.3)", fontSize: 13, color: "#7ec8e3" }}>
              今日使う車にチェックを入れてください。ドライバーが参加している場合のみ有効になります。
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              {carDefs.map((carDef) => {
                const isChecked = activeCars[carDef.carName];
                const isAvailable = !!attendees.find((a) => a.name === carDef.driverName && a.role === carDef.driverRole);
                return (
                  <div key={carDef.carName} style={{ padding: "14px 16px", borderRadius: 12, background: isChecked && isAvailable ? "rgba(126,200,227,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${isChecked && isAvailable ? "#7ec8e366" : "rgba(255,255,255,0.08)"}`, opacity: isAvailable ? 1 : 0.45 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, cursor: "pointer" }} onClick={() => isAvailable && toggleCar(carDef.carName)}>
                        <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${isChecked && isAvailable ? "#7ec8e3" : "rgba(255,255,255,0.3)"}`, background: isChecked && isAvailable ? "#7ec8e3" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#0d1b2a", flexShrink: 0 }}>
                          {isChecked && isAvailable ? "✓" : ""}
                        </div>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: "bold", color: isChecked && isAvailable ? "#e8dcc8" : "#8899aa" }}>🚗 {carDef.carName}</div>
                          <div style={{ fontSize: 11, color: "#7ec8e3", marginTop: 2 }}>
                            運転手：{carDef.driverName}（{carDef.driverRole === "coach" ? "コーチ" : "ママーズ"}）　定員：{carDef.capacity}人
                            {carDef.isBaggageCar && <span style={{ marginLeft: 8, color: "#c8a84b" }}>🎒 荷物車</span>}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {!isAvailable && <span style={{ fontSize: 11, color: "#e38a7e" }}>未参加</span>}
                        <button onClick={(e) => { e.stopPropagation(); removeCar(carDef.carName); }} style={{ background: "none", border: "none", color: "#556677", cursor: "pointer", fontSize: 16, padding: "0 4px" }}>×</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 車追加フォーム */}
            <div style={{ marginBottom: 20, padding: 16, background: "rgba(255,255,255,0.04)", borderRadius: 12, border: "1px dashed rgba(255,255,255,0.15)" }}>
              <div style={{ fontSize: 12, color: "#7ec8e3", marginBottom: 12, fontWeight: "bold" }}>＋ 車・ドライバーを追加</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input value={newCarName} onChange={(e) => setNewCarName(e.target.value)} placeholder="車の名前（例：山田号）"
                  style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "#e8dcc8", fontSize: 13 }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={newCarDriver} onChange={(e) => setNewCarDriver(e.target.value)} placeholder="運転手の名前"
                    style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "#e8dcc8", fontSize: 13 }} />
                  <select value={newCarDriverRole} onChange={(e) => setNewCarDriverRole(e.target.value)}
                    style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "#1a3a5c", color: "#e8dcc8", fontSize: 13 }}>
                    <option value="coach">コーチ</option>
                    <option value="parent">ママーズ</option>
                  </select>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "#c8a84b", whiteSpace: "nowrap" }}>🚗 乗車人数（運転手含む）</span>
                  <select value={newCarCapacity} onChange={(e) => setNewCarCapacity(parseInt(e.target.value))}
                    style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "#1a3a5c", color: "#e8dcc8", fontSize: 13 }}>
                    {[2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}人</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setNewCarIsBaggage(!newCarIsBaggage)}>
                  <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${newCarIsBaggage ? "#c8a84b" : "rgba(255,255,255,0.3)"}`, background: newCarIsBaggage ? "#c8a84b" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#0d1b2a" }}>
                    {newCarIsBaggage ? "✓" : ""}
                  </div>
                  <span style={{ fontSize: 13, color: "#e8dcc8" }}>🎒 荷物車にする</span>
                </div>
                <button onClick={addCar} disabled={!newCarName.trim() || !newCarDriver.trim()} style={{ padding: "10px", borderRadius: 8, border: "none", background: (newCarName.trim() && newCarDriver.trim()) ? "#c8a84b" : "rgba(255,255,255,0.1)", color: (newCarName.trim() && newCarDriver.trim()) ? "#0d1b2a" : "#556677", fontSize: 13, fontWeight: "bold", cursor: (newCarName.trim() && newCarDriver.trim()) ? "pointer" : "not-allowed" }}>追加する</button>
              </div>
            </div>

            {/* 座席サマリー */}
            {availableCars.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                <div style={{ padding: "12px 16px", borderRadius: 10, background: seatOk ? "rgba(168,216,92,0.1)" : "rgba(227,138,126,0.1)", border: `1px solid ${seatOk ? "#a8d85c66" : "#e38a7e66"}` }}>
                  <div style={{ fontSize: 13, color: seatOk ? "#a8d85c" : "#e38a7e" }}>
                    {seatOk ? "✓" : "⚠️"} 車 {availableCars.length}台 ／ 空き座席 {totalSeats}席 ／ 同乗者 {nonDriverCount}人
                    {!seatOk && <div style={{ marginTop: 4, fontSize: 12 }}>座席が足りません。使う車を増やしてください。</div>}
                  </div>
                </div>
                <div style={{ padding: "12px 16px", borderRadius: 10, background: baggageCarOk ? "rgba(168,216,92,0.1)" : "rgba(227,138,126,0.1)", border: `1px solid ${baggageCarOk ? "#a8d85c66" : "#e38a7e66"}` }}>
                  <div style={{ fontSize: 13, color: baggageCarOk ? "#a8d85c" : "#e38a7e" }}>
                    {baggageCarOk ? "✓ 🎒 荷物車あり" : "⚠️ 🎒 荷物車が選択されていません（菅原号または田中号を選択してください）"}
                  </div>
                </div>
              </div>
            )}

            <button onClick={handleGenerate} disabled={!canGenerate} style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: canGenerate ? "linear-gradient(135deg, #7ec8e3, #5ab8d3)" : "rgba(255,255,255,0.1)", color: canGenerate ? "#0d1b2a" : "#556677", fontSize: 15, fontWeight: "bold", cursor: canGenerate ? "pointer" : "not-allowed" }}>
              ⚾ 配車を自動生成する
            </button>
          </div>
        )}

        {/* ③ 結果タブ */}
        {tab === "result" && (
          <div>
            {!result ? (
              <div style={{ textAlign: "center", padding: 40, color: "#556677" }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>⚾</div>
                <div>まず車・ドライバーを設定して配車を生成してください</div>
                <button onClick={() => setTab("drive")} style={{ marginTop: 16, padding: "10px 24px", borderRadius: 20, border: "none", background: "#c8a84b", color: "#0d1b2a", fontSize: 13, fontWeight: "bold", cursor: "pointer" }}>車・ドライバー設定へ</button>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: 16, padding: "12px 16px", background: "rgba(200,168,75,0.1)", borderRadius: 10, border: "1px solid rgba(200,168,75,0.3)", fontSize: 13, color: "#c8a84b" }}>
                  ✓ 配車が完了しました！参加者 {attendees.length}人 ／ {result.length}台
                </div>
                {result.map((car, i) => (
                  <div key={i} style={{ marginBottom: 14, borderRadius: 14, overflow: "hidden", border: "1px solid rgba(200,168,75,0.3)", background: "rgba(255,255,255,0.03)" }}>
                    <div style={{ padding: "12px 16px", background: "linear-gradient(135deg, #1a3a5c, #0d2137)", borderBottom: "1px solid rgba(200,168,75,0.3)", display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 20 }}>🚗</span>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: "bold", color: "#c8a84b" }}>
                          {car.carName}
                          {car.isBaggageCar && <span style={{ fontSize: 12, marginLeft: 8 }}>🎒 荷物車</span>}
                        </div>
                        <div style={{ fontSize: 11, color: "#7ec8e3" }}>
                          定員{car.capacity}人 ／ 乗車{car.passengers.length + 1}人
                          {car.hasParent && <span style={{ marginLeft: 8, color: "#a8d85c" }}>✓ ママーズ同乗</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: "8px 12px", borderRadius: 8, background: "rgba(126,200,227,0.1)" }}>
                        <span>🧢</span>
                        <span style={{ fontSize: 13, color: "#7ec8e3" }}>運転手：{car.driver.name}</span>
                        <span style={{ fontSize: 11, color: roleColor[car.driver.role].text, marginLeft: "auto" }}>{roleLabel[car.driver.role]}</span>
                      </div>
                      {car.passengers.length > 0 ? car.passengers.map((p, j) => (
                        <div key={j} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", borderRadius: 8, marginBottom: 4, background: "rgba(255,255,255,0.03)" }}>
                          <span style={{ fontSize: 12 }}>👤</span>
                          <span style={{ fontSize: 13, color: "#e8dcc8" }}>{p.name}</span>
                          <span style={{ fontSize: 11, color: roleColor[p.role].text, marginLeft: "auto" }}>{roleLabel[p.role]}</span>
                        </div>
                      )) : (
                        <div style={{ fontSize: 12, color: "#556677", padding: "6px 12px" }}>同乗者なし</div>
                      )}
                    </div>
                  </div>
                ))}
                <button onClick={handleGenerate} style={{ width: "100%", padding: "12px", borderRadius: 12, border: "1px solid rgba(200,168,75,0.5)", background: "transparent", color: "#c8a84b", fontSize: 14, fontWeight: "bold", cursor: "pointer", marginTop: 8 }}>
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
