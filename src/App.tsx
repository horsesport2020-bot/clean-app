import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";

type Tenant = {
  id: number;
  name: string;
  phone: string;
  start: string;
  end: string;
};

type Building = {
  id: number;
  name: string;
  tenants: Tenant[];
};

const APP_PASSWORD = "Ayman1972";

function parseLocalDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatArabicDate(date: string) {
  if (!date) return "-";
  const d = parseLocalDate(date);
  if (Number.isNaN(d.getTime())) return date;

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
}

function getContractDuration(startDate: string, endDate: string) {
  if (!startDate || !endDate) return 0;

  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);

  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const diff = end.getTime() - start.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getDaysLeft(endDate: string) {
  if (!endDate) return 0;

  const today = new Date();
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = parseLocalDate(endDate);

  const diff = end.getTime() - current.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function App() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);

  const [showBuildingForm, setShowBuildingForm] = useState(false);
  const [newBuildingName, setNewBuildingName] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [search, setSearch] = useState("");
  const [showTenantForm, setShowTenantForm] = useState(false);

  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [popupMessage, setPopupMessage] = useState("");
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    try {
      const unsubscribe = onSnapshot(collection(db, "buildings"), (snapshot) => {
        const data = snapshot.docs.map((docItem) => docItem.data() as Building);
        setBuildings(data);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Firestore error:", error);
    }
  }, []);

  const selectedBuilding = useMemo(() => {
    return buildings.find((b) => b.id === selectedBuildingId) || null;
  }, [buildings, selectedBuildingId]);

  const previewDays = useMemo(() => {
    if (!start || !end) return "-";
    return `${getContractDuration(start, end)} يوم`;
  }, [start, end]);

  const filteredTenants = useMemo(() => {
    if (!selectedBuilding) return [];
    const value = search.trim().toLowerCase();
    if (!value) return selectedBuilding.tenants;

    return selectedBuilding.tenants.filter(
      (tenant) =>
        tenant.name.toLowerCase().includes(value) ||
        tenant.phone.toLowerCase().includes(value)
    );
  }, [search, selectedBuilding]);

  const stats = useMemo(() => {
    if (!selectedBuilding) {
      return { total: 0, expiringSoon: 0, expired: 0 };
    }

    const total = selectedBuilding.tenants.length;
    const expiringSoon = selectedBuilding.tenants.filter((t) => {
      const days = getDaysLeft(t.end);
      return days >= 0 && days <= 30;
    }).length;
    const expired = selectedBuilding.tenants.filter((t) => getDaysLeft(t.end) < 0).length;

    return { total, expiringSoon, expired };
  }, [selectedBuilding]);

  function handleLogin() {
    if (passwordInput === APP_PASSWORD) {
      setIsAuthenticated(true);
      setPasswordError("");
    } else {
      setPasswordError("الباسورد غير صحيح");
    }
  }

  function openPopup(message: string) {
    setPopupMessage(message);
    setShowPopup(true);
  }

  function resetTenantForm() {
    setName("");
    setPhone("");
    setStart("");
    setEnd("");
  }

  async function addBuilding() {
    if (!newBuildingName.trim()) {
      alert("يرجى كتابة اسم البناية");
      return;
    }

    try {
      const newBuilding: Building = {
        id: Date.now(),
        name: newBuildingName.trim(),
        tenants: [],
      };

      await setDoc(doc(db, "buildings", String(newBuilding.id)), newBuilding);

      openPopup("تم حفظ البناية بنجاح");
      setNewBuildingName("");
      setShowBuildingForm(false);
    } catch (error) {
      console.error("addBuilding error:", error);
      alert("فشل حفظ البناية");
    }
  }

  async function deleteBuilding(id: number) {
    const ok = window.confirm("هل تريد حذف هذه البناية وكل المستأجرين داخلها؟");
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "buildings", String(id)));

      if (selectedBuildingId === id) {
        setSelectedBuildingId(null);
      }

      openPopup("تم حذف البناية بنجاح");
    } catch (error) {
      console.error("deleteBuilding error:", error);
      alert("فشل حذف البناية");
    }
  }

  async function addTenant() {
    if (!selectedBuilding) return;

    if (!name.trim() || !phone.trim() || !start || !end) {
      alert("يرجى تعبئة جميع الحقول");
      return;
    }

    if (parseLocalDate(end).getTime() < parseLocalDate(start).getTime()) {
      alert("تاريخ نهاية العقد يجب أن يكون بعد بداية العقد");
      return;
    }

    try {
      const newTenant: Tenant = {
        id: Date.now(),
        name: name.trim(),
        phone: phone.trim(),
        start,
        end,
      };

      const updatedTenants = [newTenant, ...selectedBuilding.tenants];

      await updateDoc(doc(db, "buildings", String(selectedBuilding.id)), {
        tenants: updatedTenants,
      });

      openPopup("تم حفظ المستأجر بنجاح");
      resetTenantForm();
      setShowTenantForm(false);
    } catch (error) {
      console.error("addTenant error:", error);
      alert("فشل حفظ المستأجر");
    }
  }

  async function deleteTenant(id: number) {
    if (!selectedBuilding) return;

    const ok = window.confirm("هل تريد حذف هذا المستأجر؟");
    if (!ok) return;

    try {
      const updatedTenants = selectedBuilding.tenants.filter(
        (tenant) => tenant.id !== id
      );

      await updateDoc(doc(db, "buildings", String(selectedBuilding.id)), {
        tenants: updatedTenants,
      });

      openPopup("تم حذف المستأجر بنجاح");
    } catch (error) {
      console.error("deleteTenant error:", error);
      alert("فشل حذف المستأجر");
    }
  }

  function getStatus(daysLeft: number) {
    if (daysLeft < 0) {
      return { label: `منتهي من ${Math.abs(daysLeft)} يوم`, color: "#dc2626", bg: "#fee2e2" };
    }
    if (daysLeft <= 30) {
      return { label: `ينتهي خلال ${daysLeft} يوم`, color: "#d97706", bg: "#fef3c7" };
    }
    return { label: "نشط", color: "#2563eb", bg: "#dbeafe" };
  }

  if (!isAuthenticated) {
    return (
      <div
        dir="rtl"
        style={{
          minHeight: "100vh",
          background: "#f5f7fb",
          fontFamily: "Arial, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 460,
            background: "white",
            borderRadius: 28,
            padding: 32,
            boxShadow: "0 24px 70px rgba(0, 0, 0, 0.12)",
            border: "1px solid #e5e7eb",
          }}
        >
          <div
            style={{
              display: "inline-block",
              background: "#e0e7ff",
              color: "#3730a3",
              padding: "8px 14px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 700,
              marginBottom: 14,
            }}
          >
            حماية الدخول
          </div>

          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800 }}>دخول إلى النظام</h1>

          <p style={{ margin: "10px 0 24px", color: "#6b7280", fontSize: 16 }}>
            أدخل الباسورد لفتح نظام إدارة المستأجرين.
          </p>

          <input
            type="password"
            value={passwordInput}
            onChange={(e) => {
              setPasswordInput(e.target.value);
              setPasswordError("");
            }}
            placeholder="اكتب الباسورد"
            style={inputStyle}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleLogin();
            }}
          />

          {passwordError ? (
            <div
              style={{
                marginTop: 12,
                color: "#dc2626",
                background: "#fee2e2",
                padding: "12px 14px",
                borderRadius: 14,
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              {passwordError}
            </div>
          ) : null}

          <button
            onClick={handleLogin}
            style={{
              width: "100%",
              marginTop: 18,
              border: "none",
              background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
              color: "white",
              borderRadius: 16,
              padding: "15px 16px",
              fontWeight: 700,
              fontSize: 16,
              cursor: "pointer",
              boxShadow: "0 14px 30px rgba(37, 99, 235, 0.24)",
            }}
          >
            دخول
          </button>
        </div>
      </div>
    );
  }

  if (selectedBuilding === null) {
    return (
      <div
        dir="rtl"
        style={{
          minHeight: "100vh",
          background: "#f5f7fb",
          fontFamily: "Arial, sans-serif",
          color: "#111827",
          width: "100%",
        }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, #ffffff 0%, #eef4ff 100%)",
            borderBottom: "1px solid #e5e7eb",
            width: "100%",
          }}
        >
          <div
            style={{
              width: "100%",
              padding: "32px 40px",
              boxSizing: "border-box",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  display: "inline-block",
                  background: "#e0e7ff",
                  color: "#3730a3",
                  padding: "8px 14px",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 700,
                  marginBottom: 14,
                }}
              >
                إدارة البنايات
              </div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 42,
                  fontWeight: 800,
                  letterSpacing: -0.8,
                }}
              >
                قائمة البنايات
              </h1>
              <p style={{ margin: "10px 0 0", color: "#6b7280", fontSize: 17 }}>
                اختر البناية التي تريد إدارة مستأجريها أو أضف بناية جديدة.
              </p>
            </div>

            <button
              onClick={() => setShowBuildingForm(true)}
              style={{
                border: "none",
                background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                color: "white",
                borderRadius: 16,
                padding: "16px 22px",
                fontSize: 16,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 14px 30px rgba(37, 99, 235, 0.24)",
              }}
            >
              + إضافة بناية جديدة
            </button>
          </div>
        </div>

        <div
          style={{
            width: "100%",
            padding: 24,
            boxSizing: "border-box",
          }}
        >
          {buildings.length === 0 ? (
            <div
              style={{
                background: "white",
                border: "1px dashed #d1d5db",
                borderRadius: 24,
                padding: "80px 24px",
                textAlign: "center",
                color: "#6b7280",
                fontSize: 20,
              }}
            >
              لا توجد بنايات بعد. أضف أول بناية للبدء.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 18,
              }}
            >
              {buildings.map((building) => (
                <div
                  key={building.id}
                  style={{
                    background: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: 24,
                    padding: 24,
                    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
                  }}
                >
                  <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 14 }}>
                    {building.name}
                  </div>
                  <div style={{ color: "#6b7280", marginBottom: 20 }}>
                    عدد المستأجرين: {building.tenants.length}
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      onClick={() => setSelectedBuildingId(building.id)}
                      style={{
                        flex: 1,
                        border: "none",
                        background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                        color: "white",
                        borderRadius: 14,
                        padding: "12px 16px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      دخول إلى البناية
                    </button>

                    <button
                      onClick={() => deleteBuilding(building.id)}
                      style={{
                        border: "none",
                        background: "#fee2e2",
                        color: "#dc2626",
                        borderRadius: 14,
                        padding: "12px 16px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {showBuildingForm && (
          <div
            onClick={() => setShowBuildingForm(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.38)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
              zIndex: 999,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: 520,
                background: "white",
                borderRadius: 28,
                padding: 28,
                boxShadow: "0 24px 70px rgba(0, 0, 0, 0.2)",
              }}
            >
              <h2 style={{ marginTop: 0, marginBottom: 18, fontSize: 30 }}>إضافة بناية جديدة</h2>
              <p style={{ marginTop: 0, color: "#6b7280", marginBottom: 24 }}>
                اكتب اسم البناية لإضافتها إلى القائمة الرئيسية.
              </p>

              <input
                value={newBuildingName}
                onChange={(e) => setNewBuildingName(e.target.value)}
                placeholder="اسم البناية"
                style={inputStyle}
              />

              <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
                <button
                  onClick={() => setShowBuildingForm(false)}
                  style={{
                    flex: 1,
                    border: "none",
                    background: "#e5e7eb",
                    color: "#111827",
                    borderRadius: 16,
                    padding: "14px 16px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  إلغاء
                </button>
                <button
                  onClick={addBuilding}
                  style={{
                    flex: 1,
                    border: "none",
                    background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                    color: "white",
                    borderRadius: 16,
                    padding: "14px 16px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  حفظ البناية
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        fontFamily: "Arial, sans-serif",
        color: "#111827",
        width: "100%",
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg, #ffffff 0%, #eef4ff 100%)",
          borderBottom: "1px solid #e5e7eb",
          width: "100%",
        }}
      >
        <div
          style={{
            width: "100%",
            padding: "32px 40px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  display: "inline-block",
                  background: "#e0e7ff",
                  color: "#3730a3",
                  padding: "8px 14px",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 700,
                  marginBottom: 14,
                }}
              >
                لوحة إدارة العقود والمستأجرين
              </div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 42,
                  fontWeight: 800,
                  letterSpacing: -0.8,
                }}
              >
                {selectedBuilding.name}
              </h1>
              <p style={{ margin: "10px 0 0", color: "#6b7280", fontSize: 17 }}>
                إدارة بيانات المستأجرين والعقود الخاصة بهذه البناية.
              </p>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                onClick={() => setSelectedBuildingId(null)}
                style={{
                  border: "none",
                  background: "#e5e7eb",
                  color: "#111827",
                  borderRadius: 16,
                  padding: "16px 22px",
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                ← الرجوع إلى البنايات
              </button>

              <button
                onClick={() => setShowTenantForm(true)}
                style={{
                  border: "none",
                  background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                  color: "white",
                  borderRadius: 16,
                  padding: "16px 22px",
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 14px 30px rgba(37, 99, 235, 0.24)",
                }}
              >
                + إضافة مستأجر جديد
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          width: "100%",
          padding: 24,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 16,
            marginBottom: 24,
          }}
        >
          {[
            { title: "إجمالي المستأجرين", value: stats.total, color: "#2563eb" },
            { title: "تنتهي خلال 30 يوم", value: stats.expiringSoon, color: "#d97706" },
            { title: "العقود المنتهية", value: stats.expired, color: "#dc2626" },
          ].map((item) => (
            <div
              key={item.title}
              style={{
                background: "white",
                border: "1px solid #e5e7eb",
                borderRadius: 24,
                padding: 22,
                boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
              }}
            >
              <div style={{ color: "#6b7280", fontSize: 14, marginBottom: 12 }}>{item.title}</div>
              <div style={{ fontSize: 34, fontWeight: 800, color: item.color }}>{item.value}</div>
            </div>
          ))}
        </div>

        <div
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 24,
            padding: 18,
            marginBottom: 24,
            boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
          }}
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث باسم المستأجر أو رقم الهاتف"
            style={{
              width: "100%",
              border: "1px solid #d1d5db",
              borderRadius: 16,
              padding: "15px 18px",
              fontSize: 15,
              outline: "none",
              background: "#f9fafb",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          {filteredTenants.length === 0 ? (
            <div
              style={{
                background: "white",
                border: "1px dashed #d1d5db",
                borderRadius: 24,
                padding: "60px 24px",
                textAlign: "center",
                color: "#6b7280",
                fontSize: 18,
              }}
            >
              لا يوجد مستأجرون مطابقون للبحث أو لم يتم إضافة بيانات بعد.
            </div>
          ) : (
            filteredTenants.map((tenant) => {
              const days = getContractDuration(tenant.start, tenant.end);
              const status = getStatus(getDaysLeft(tenant.end));

              return (
                <div
                  key={tenant.id}
                  style={{
                    background: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: 28,
                    padding: 28,
                    boxShadow: "0 10px 28px rgba(15, 23, 42, 0.06)",
                    display: "grid",
                    gridTemplateColumns: "1.2fr 1fr 1fr",
                    gap: 20,
                    alignItems: "start",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 30, fontWeight: 800, marginBottom: 14 }}>{tenant.name}</div>
                    <div style={{ color: "#4b5563", fontSize: 17, marginBottom: 14 }}>{tenant.phone}</div>
                    <div
                      style={{
                        display: "inline-block",
                        background: status.bg,
                        color: status.color,
                        padding: "8px 14px",
                        borderRadius: 999,
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      {status.label}
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 18 }}>
                    <div>
                      <div style={{ color: "#6b7280", fontSize: 14, marginBottom: 8 }}>بداية العقد</div>
                      <div style={{ fontSize: 22, fontWeight: 700 }}>{formatArabicDate(tenant.start)}</div>
                    </div>
                    <div>
                      <div style={{ color: "#6b7280", fontSize: 14, marginBottom: 8 }}>نهاية العقد</div>
                      <div style={{ fontSize: 22, fontWeight: 700 }}>{formatArabicDate(tenant.end)}</div>
                    </div>
                  </div>

                  <div
                    style={{
                      background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)",
                      border: "1px solid #dbeafe",
                      borderRadius: 24,
                      padding: 24,
                      textAlign: "left",
                    }}
                  >
                    <div style={{ color: "#6b7280", fontSize: 14, marginBottom: 10 }}>مدة العقد</div>
                    <div
                      style={{
                        fontSize: 56,
                        fontWeight: 800,
                        color: days < 0 ? "#dc2626" : "#2563eb",
                        lineHeight: 1,
                      }}
                    >
                      {days}
                    </div>
                    <button
                      onClick={() => deleteTenant(tenant.id)}
                      style={{
                        marginTop: 22,
                        border: "none",
                        background: "#fee2e2",
                        color: "#dc2626",
                        borderRadius: 14,
                        padding: "12px 16px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      حذف المستأجر
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {showTenantForm && (
        <div
          onClick={() => setShowTenantForm(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.38)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 600,
              background: "white",
              borderRadius: 28,
              padding: 28,
              boxShadow: "0 24px 70px rgba(0, 0, 0, 0.2)",
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: 18, fontSize: 30 }}>إضافة مستأجر جديد</h2>
            <p style={{ marginTop: 0, color: "#6b7280", marginBottom: 24 }}>
              أدخل بيانات العقد والمستأجر لإضافته إلى القائمة.
            </p>

            <div style={{ display: "grid", gap: 14 }}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="اسم المستأجر"
                style={inputStyle}
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="رقم الهاتف"
                style={inputStyle}
              />

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  width: "100%",
                }}
              >
                <div style={{ width: "100%" }}>
                  <div style={{ marginBottom: 8, color: "#6b7280", fontSize: 14, fontWeight: 700 }}>
                    بداية العقد
                  </div>
                  <input
                    type="date"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    style={{ ...inputStyle, width: "100%" }}
                  />
                </div>

                <div style={{ width: "100%" }}>
                  <div style={{ marginBottom: 8, color: "#6b7280", fontSize: 14, fontWeight: 700 }}>
                    نهاية العقد
                  </div>
                  <input
                    type="date"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    style={{ ...inputStyle, width: "100%" }}
                  />
                </div>
              </div>

              <div
                style={{
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  borderRadius: 16,
                  padding: 16,
                  fontWeight: 700,
                }}
              >
                مدة العقد: {previewDays}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
              <button
                onClick={() => setShowTenantForm(false)}
                style={{
                  flex: 1,
                  border: "none",
                  background: "#e5e7eb",
                  color: "#111827",
                  borderRadius: 16,
                  padding: "14px 16px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                إلغاء
              </button>
              <button
                onClick={addTenant}
                style={{
                  flex: 1,
                  border: "none",
                  background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                  color: "white",
                  borderRadius: 16,
                  padding: "14px 16px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                حفظ المستأجر
              </button>
            </div>
          </div>
        </div>
      )}

      {showPopup && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.38)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 9999,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              background: "white",
              borderRadius: 28,
              padding: 28,
              boxShadow: "0 24px 70px rgba(0, 0, 0, 0.2)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: "#111827",
                marginBottom: 18,
              }}
            >
              {popupMessage}
            </div>

            <button
              onClick={() => setShowPopup(false)}
              style={{
                border: "none",
                background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                color: "white",
                borderRadius: 16,
                padding: "14px 34px",
                fontSize: 18,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 14px 30px rgba(37, 99, 235, 0.24)",
              }}
            >
              تم
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  border: "1px solid #d1d5db",
  borderRadius: 16,
  padding: "15px 16px",
  fontSize: 15,
  outline: "none",
  background: "#f9fafb",
  boxSizing: "border-box",
};