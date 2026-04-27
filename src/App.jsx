import React, { useState, useEffect } from 'react';
import { 
  Leaf, 
  Droplets, 
  AlertTriangle, 
  Save,
  LayoutDashboard,
  Sprout,
  CheckCircle2,
  Camera,
  Settings,
  Activity,
  Plus,
  Trash2,
  UserCircle,
  MapPin,
  QrCode,
  CalendarDays,
  Download
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  setDoc,
  onSnapshot, 
  deleteDoc
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyCm_zUaTZnhJcm0OLpjsuVj_D2XWWAGoC0",
  authDomain: "maju-agro.firebaseapp.com",
  projectId: "maju-agro",
  storageBucket: "maju-agro.firebasestorage.app",
  messagingSenderId: "631206119324",
  appId: "1:631206119324:web:83b43f1d46aea64935ea59",
  measurementId: "G-3XQSZFRY1N"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'maju-agro-monitor';

// --- Mock Data Awal (Untuk Seeding Jika Cloud Kosong) ---
const initialPlants = [
  { 
    id: '1', treeCode: 'A1-001-01', jenisTanaman: 'Alpukat', varietas: 'Miki', supplier: 'CV Bibit Unggul',
    subzona: 'A1', jalur: '1', noPohon: '1', gps: '-6.200000, 106.816666',
    tglTanam: '2023-03-01', tglTambalSulam: '', 
    fase: 'TM', status: 'Sehat', 
    panenTotal: 15, panenTgl: '2025-10-12', panenVol: 5, prediksiBlnThn: '2026-10', prediksiVol: 20,
    tsTgl: '', tsVarietas: '', tsKeterangan: '', photo: null, notes: 'Pertumbuhan sangat baik, sudah mulai berbuah stabil.' 
  },
  { 
    id: '2', treeCode: 'B1-012-05', jenisTanaman: 'Jambu Air', varietas: 'Madu Deli', supplier: 'Koperasi Tani',
    subzona: 'B1', jalur: '12', noPohon: '5', gps: '-6.201000, 106.817000',
    tglTanam: '2025-01-15', tglTambalSulam: '2025-06-10', 
    fase: 'TBM', status: 'Tambal Sulam', 
    panenTotal: 0, panenTgl: '', panenVol: 0, prediksiBlnThn: '', prediksiVol: 0,
    tsTgl: '2025-06-10', tsVarietas: 'Madu Deli Hijau', tsKeterangan: 'Pohon lama mati kekeringan', photo: null, notes: 'Pohon baru pengganti.' 
  },
];

const initialLogs = [
  { id: '1', plantId: '1', type: 'Penyiraman', date: '2026-04-06', officer: 'Siddhartha (Admin)', notes: 'Penyiraman rutin 500ml', photo: null }
];

const defaultSettings = {
  officerName: 'Siddhartha',
  role: 'Admin', 
  activityItems: ['Pengecekan Rutin', 'Penyiraman', 'Pemupukan Organik', 'Penyemprotan Hama', 'Pemangkasan (Pruning)'],
  // Pengaturan default untuk kolom export Excel
  exportColumns: {
    treeCode: true,
    jenisTanaman: true,
    varietas: true,
    subzona: true,
    status: true,
    fase: true,
    tglTanam: true,
    gps: false,
    panenTotal: false,
    notes: true
  }
};

export default function App() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('plants'); 
  
  // Data State
  const [plants, setPlants] = useState([]);
  const [logs, setLogs] = useState([]);
  const [settings, setSettings] = useState(defaultSettings);
  
  // Modals State
  const [showAddPlant, setShowAddPlant] = useState(false);
  const [showAddLog, setShowAddLog] = useState(false);
  const [selectedPlant, setSelectedPlant] = useState(null);

  // Form State Tanaman
  const defaultPlantState = {
    jenisTanaman: '', varietas: '', supplier: '',
    subzona: 'A1', jalur: '', noPohon: '', gps: '',
    tglTanam: new Date().toISOString().split('T')[0], tglTambalSulam: '',
    fase: 'TBM', 
    status: 'Sehat', 
    panenTotal: '', panenTgl: '', panenVol: '', prediksiBlnThn: '', prediksiVol: '',
    tsTgl: '', tsVarietas: '', tsKeterangan: '',
    photo: null, notes: ''
  };
  const [newPlant, setNewPlant] = useState(defaultPlantState);
  const [newLog, setNewLog] = useState({ plantId: '', type: defaultSettings.activityItems[0], notes: '', photo: null });

  // 1. Inisialisasi Auth
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Kesalahan Auth:", err);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Sinkronisasi Data Firestore
  useEffect(() => {
    if (!user) return;

    const plantsRef = collection(db, 'artifacts', appId, 'public', 'data', 'plants');
    const logsRef = collection(db, 'artifacts', appId, 'public', 'data', 'logs');
    const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'app_settings');

    const unsubPlants = onSnapshot(plantsRef, (snapshot) => {
      if (snapshot.empty) {
        initialPlants.forEach(async (p) => {
          await setDoc(doc(plantsRef, p.id), { ...p, createdAt: Date.now() });
        });
      } else {
        const pData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        pData.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setPlants(pData);
      }
    }, console.error);

    const unsubLogs = onSnapshot(logsRef, (snapshot) => {
      if (snapshot.empty) {
        initialLogs.forEach(async (l) => {
          await setDoc(doc(logsRef, l.id), { ...l, createdAt: Date.now() });
        });
      } else {
        const lData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        lData.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setLogs(lData);
      }
    }, console.error);

    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Pastikan exportColumns ada untuk mencegah error bagi user lama
        if (!data.exportColumns) {
           data.exportColumns = defaultSettings.exportColumns;
        }
        setSettings(data);
      } else {
        setDoc(settingsRef, defaultSettings);
      }
    }, console.error);

    return () => {
      unsubPlants();
      unsubLogs();
      unsubSettings();
    };
  }, [user]);

  const updateSettings = async (newSettings) => {
    setSettings(newSettings);
    if (user) {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'app_settings'), newSettings);
    }
  };

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setNewPlant({...newPlant, gps: `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`});
        },
        (error) => alert('Gagal mendapatkan GPS. Pastikan izin lokasi aktif.')
      );
    } else {
      alert('GPS tidak didukung di perangkat ini.');
    }
  };

  const handleAddPlant = async (e) => {
    e.preventDefault();
    if (!user) return;
    
    const jalurStr = newPlant.jalur.toString().padStart(3, '0');
    const noStr = newPlant.noPohon.toString().padStart(2, '0');
    const treeCode = `${newPlant.subzona}-${jalurStr}-${noStr}`;

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'plants'), {
        ...newPlant,
        treeCode,
        createdAt: Date.now()
      });
      setShowAddPlant(false);
      setNewPlant(defaultPlantState);
    } catch (err) {
      console.error(err);
    }
  };

  const deletePlant = async (id) => {
    if (!user) return;
    if (!window.confirm('Hapus data tanaman ini?')) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'plants', id.toString()));
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddLog = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (!newLog.plantId) return alert('Pilih tanaman terlebih dahulu!');
    
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'logs'), {
        plantId: newLog.plantId,
        type: newLog.type,
        date: new Date().toISOString().split('T')[0],
        officer: `${settings.officerName} (${settings.role})`,
        notes: newLog.notes,
        photo: newLog.photo,
        createdAt: Date.now()
      });
      
      setShowAddLog(false);
      setNewLog({ plantId: '', type: settings.activityItems[0] || 'Aktivitas', notes: '', photo: null });
    } catch (err) {
      console.error(err);
    }
  };

  const handlePhotoCapture = (e, target) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if(target === 'log') setNewLog({ ...newLog, photo: reader.result });
        if(target === 'plant') setNewPlant({ ...newPlant, photo: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  // --- Fungsi Export Excel (CSV) ---
  const exportToExcel = () => {
    if (plants.length === 0) return alert('Belum ada data untuk diekspor.');

    // 1. Dapatkan kolom yang diaktifkan dari settings
    const activeColumns = Object.keys(settings.exportColumns || defaultSettings.exportColumns)
      .filter(key => settings.exportColumns[key]);

    if (activeColumns.length === 0) return alert('Pilih minimal satu kolom untuk diekspor di menu Pengaturan.');

    // 2. Buat header CSV
    // Format label header agar lebih rapi (misal: "jenisTanaman" -> "Jenis Tanaman")
    const formatLabel = (key) => key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    const headerRow = activeColumns.map(formatLabel).join(',');

    // 3. Buat baris data
    const dataRows = plants.map(plant => {
      return activeColumns.map(key => {
        // Hilangkan koma/koma baris baru yang bisa merusak format CSV
        let cellValue = plant[key] || '';
        if (typeof cellValue === 'string') {
          cellValue = `"${cellValue.replace(/"/g, '""')}"`; 
        }
        return cellValue;
      }).join(',');
    });

    // 4. Gabungkan dan buat file
    const csvContent = [headerRow, ...dataRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    // 5. Trigger download otomatis
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Laporan_Kebun_Maju_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <Leaf className="text-green-600 animate-pulse" size={40} />
          <p className="text-green-900 font-bold">Memuat Sistem Cloud...</p>
        </div>
      </div>
    );
  }

  // --- KOMPONEN TAB ---

  const Dashboard = () => (
    <div className="space-y-6 animate-in fade-in">
      <h2 className="text-2xl font-bold text-green-800">Ringkasan Kebun</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-green-100">
          <p className="text-xs text-gray-500 font-medium">Total Tanaman</p>
          <p className="text-2xl font-bold text-gray-800">{plants.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-blue-100">
          <p className="text-xs text-gray-500 font-medium">Kondisi Sehat</p>
          <p className="text-2xl font-bold text-blue-600">{plants.filter(p => p.status === 'Sehat').length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-orange-100">
          <p className="text-xs text-gray-500 font-medium">Abnormal/Mati</p>
          <p className="text-2xl font-bold text-orange-600">{plants.filter(p => p.status === 'Abnormal' || p.status === 'Mati').length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-purple-100">
          <p className="text-xs text-gray-500 font-medium">Total Log Aktivitas</p>
          <p className="text-2xl font-bold text-purple-600">{logs.length}</p>
        </div>
      </div>
      
      <div className="bg-green-50 p-5 rounded-xl border border-green-200 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h3 className="font-semibold text-green-800">Halo, {settings.officerName}!</h3>
          <p className="text-sm text-gray-600">Akses Anda: <span className="font-medium bg-green-200 px-2 py-0.5 rounded text-green-800">{settings.role}</span></p>
        </div>
        <button onClick={() => setShowAddLog(true)} className="w-full sm:w-auto bg-green-600 text-white px-4 py-2 rounded-lg font-medium shadow-sm flex items-center justify-center hover:bg-green-700">
          <Plus size={18} className="mr-1"/> Catat Aktivitas
        </button>
      </div>
    </div>
  );

  const PlantList = () => (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h2 className="text-2xl font-bold text-green-800">Database Tanaman</h2>
        <div className="flex items-center gap-2">
          {/* Tombol Export Excel */}
          <button 
            onClick={exportToExcel}
            className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 px-3 py-2 rounded-lg text-sm font-medium shadow-sm flex items-center transition-colors"
            title="Export ke CSV (Excel)"
          >
            <Download size={16} className="mr-1 sm:mr-2"/> 
            <span className="hidden sm:inline">Export Excel</span>
          </button>

          {settings.role !== 'Petugas' && (
            <button onClick={() => setShowAddPlant(true)} className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-medium shadow-sm flex items-center transition-colors">
              <Plus size={16} className="mr-1 sm:mr-2"/> 
              <span className="hidden sm:inline">Tambah Data</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plants.map(plant => (
          <div key={plant.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-800 font-mono tracking-tight flex items-center gap-2">
                  <QrCode size={16} className="text-gray-400"/>
                  {plant.treeCode}
                </h3>
                <p className="text-sm text-gray-600 mt-1">{plant.jenisTanaman} • {plant.varietas}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`px-2 py-1 rounded text-xs font-semibold ${plant.status === 'Sehat' ? 'bg-green-100 text-green-700' : plant.status === 'Abnormal' ? 'bg-orange-100 text-orange-700' : plant.status === 'Mati' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                  {plant.status}
                </span>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${plant.fase === 'TM' ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700'}`}>
                  {plant.fase === 'TM' ? 'Generatif (TM)' : 'Vegetatif (TBM)'}
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-gray-500 mb-3">
              <div className="flex items-center gap-1"><MapPin size={12}/> {plant.gps || 'Belum diset'}</div>
              <div className="flex items-center gap-1"><CalendarDays size={12}/> Tanam: {plant.tglTanam}</div>
            </div>

            {plant.fase === 'TM' && (
              <div className="bg-purple-50 p-2 rounded-lg text-xs text-purple-800 mb-3 border border-purple-100">
                <span className="font-semibold">Panen:</span> {plant.panenTotal} Kg (Total) • Prediksi: {plant.prediksiBlnThn} ({plant.prediksiVol} Kg)
              </div>
            )}

            <div className="bg-gray-50 p-2.5 rounded-lg text-xs text-gray-700 italic border-l-2 border-green-400">
              "{plant.notes}"
            </div>
            
            {plant.photo && (
              <div className="mt-3">
                <img src={plant.photo} alt="Foto Tanaman" className="h-20 w-full object-cover rounded-lg" />
              </div>
            )}

            <div className="absolute bottom-4 right-4 flex space-x-1 opacity-0 hover:opacity-100 transition-opacity">
               <button onClick={() => deletePlant(plant.id)} className="bg-red-50 text-red-500 p-2 rounded-lg hover:bg-red-100 transition-colors shadow-sm">
                  <Trash2 size={16} />
               </button>
            </div>
          </div>
        ))}
        {plants.length === 0 && <p className="text-center text-gray-500 py-8 col-span-2">Belum ada tanaman terdaftar.</p>}
      </div>
    </div>
  );

  const ActivityLogs = () => (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-green-800">Log & Aktivitas</h2>
        <button onClick={() => setShowAddLog(true)} className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-medium shadow-sm flex items-center hover:bg-green-700">
          <Plus size={16} className="mr-1"/> Catat
        </button>
      </div>
      <div className="space-y-3">
        {logs.map(log => {
          const plant = plants.find(p => p.id === log.plantId);
          return (
            <div key={log.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4">
              {log.photo && (
                <div className="w-full sm:w-24 h-32 sm:h-24 flex-shrink-0">
                  <img src={log.photo} alt="Bukti" className="w-full h-full object-cover rounded-lg border border-gray-200" />
                </div>
              )}
              <div className="flex-1">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-bold text-green-800">{log.type}</h3>
                  <span className="text-xs text-gray-500">{log.date}</span>
                </div>
                <p className="text-sm font-medium text-gray-700 mb-1">Target: {plant ? `${plant.treeCode} (${plant.jenisTanaman})` : 'Umum'}</p>
                <p className="text-sm text-gray-600 mb-2">{log.notes}</p>
                <div className="flex items-center text-xs text-gray-400">
                  <UserCircle size={14} className="mr-1"/> Dilaporkan oleh: {log.officer}
                </div>
              </div>
            </div>
          )
        })}
        {logs.length === 0 && <p className="text-center text-gray-500 py-8">Belum ada aktivitas tercatat.</p>}
      </div>
    </div>
  );

  const SettingsTab = () => {
    const [newItem, setNewItem] = useState('');
    
    // Fungsi khusus untuk toggle kolom export Excel
    const toggleColumn = (columnKey) => {
      const currentCols = settings.exportColumns || defaultSettings.exportColumns;
      updateSettings({
        ...settings,
        exportColumns: {
          ...currentCols,
          [columnKey]: !currentCols[columnKey]
        }
      });
    };

    return (
      <div className="max-w-xl mx-auto space-y-6 animate-in fade-in">
        <h2 className="text-2xl font-bold text-green-800 mb-4">Pengaturan Sistem</h2>
        
        {/* Pengaturan Akun */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
          <h3 className="font-bold text-gray-800 mb-2">Akun & Akses</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Petugas / Pengguna</label>
            <input type="text" value={settings.officerName} onChange={e => updateSettings({...settings, officerName: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-green-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Level Akses (Role)</label>
            <select value={settings.role} onChange={e => updateSettings({...settings, role: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-green-500 outline-none">
              <option value="Admin">Admin (Akses Penuh)</option>
              <option value="Mandor">Mandor (Akses Data & Log)</option>
              <option value="Petugas">Petugas Lapangan (Hanya Input Log)</option>
            </select>
          </div>
        </div>

        {/* Pengaturan Export Excel */}
        {settings.role === 'Admin' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-1 flex items-center">
               <Download size={18} className="mr-2 text-blue-600"/> Pengaturan Laporan (Excel)
            </h3>
            <p className="text-xs text-gray-500 mb-4">Pilih kolom informasi yang ingin ditampilkan saat mengunduh laporan.</p>
            
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(settings.exportColumns || defaultSettings.exportColumns).map(([key, isActive]) => (
                <label key={key} className="flex items-center space-x-2 cursor-pointer bg-gray-50 p-2 rounded-lg border border-gray-200 hover:bg-gray-100">
                  <input 
                    type="checkbox" 
                    checked={isActive} 
                    onChange={() => toggleColumn(key)}
                    className="rounded text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Pengaturan Aktivitas */}
        {settings.role === 'Admin' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-3">Daftar Item Aktivitas/Monitoring</h3>
            <div className="space-y-2 mb-4">
              {settings.activityItems.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-200">
                  <span className="text-sm">{item}</span>
                  <button onClick={() => updateSettings({...settings, activityItems: settings.activityItems.filter((_, i) => i !== idx)})} className="text-red-500 hover:bg-red-50 p-1 rounded transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" value={newItem} onChange={e => setNewItem(e.target.value)} placeholder="Aktivitas baru..." className="flex-1 p-2 border border-gray-300 rounded-lg text-sm" />
              <button onClick={() => { if(newItem) { updateSettings({...settings, activityItems: [...settings.activityItems, newItem]}); setNewItem(''); } }} className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">Tambah</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f3f6f4] font-sans pb-20 sm:pb-0">
      {/* Top / Mobile Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:h-16 py-3 sm:py-0">
            <div className="flex items-center justify-between mb-3 sm:mb-0">
              <div className="flex items-center">
                <Leaf className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
                <span className="ml-2 text-lg sm:text-xl font-bold text-green-900 tracking-tight">Maju Agro</span>
              </div>
            </div>
            {/* Scrollable Nav for mobile */}
            <div className="flex overflow-x-auto hide-scrollbar space-x-2 sm:space-x-4 items-center">
              {[
                { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
                { id: 'plants', icon: Sprout, label: 'Tanaman' },
                { id: 'logs', icon: Activity, label: 'Aktivitas' },
                { id: 'settings', icon: Settings, label: 'Pengaturan' }
              ].map(tab => (
                <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-shrink-0 px-3 py-2 sm:px-4 rounded-lg flex items-center text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-green-100 text-green-800' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <tab.icon size={16} className="sm:mr-2" />
                  <span className={`${activeTab === tab.id ? 'inline' : 'hidden sm:inline'} ml-1 sm:ml-0`}>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'plants' && <PlantList />}
        {activeTab === 'logs' && <ActivityLogs />}
        {activeTab === 'settings' && <SettingsTab />}

        {/* ===================== MODAL TAMBAH TANAMAN (Diperluas) ===================== */}
        {showAddPlant && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4">
              <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="text-xl font-bold text-green-800">Formulir Tanaman Baru</h3>
                <div className="bg-white px-3 py-1 rounded border border-gray-200 text-sm font-mono text-gray-600 flex items-center gap-2">
                  <QrCode size={14}/> ID: {newPlant.subzona}-{newPlant.jalur.toString().padStart(3,'0')}-{newPlant.noPohon.toString().padStart(2,'0')}
                </div>
              </div>
              
              <div className="overflow-y-auto flex-1 p-4 sm:p-6">
                <form id="addPlantForm" onSubmit={handleAddPlant} className="space-y-6">
                  
                  {/* --- DATA UMUM --- */}
                  <div>
                    <h4 className="font-semibold text-green-700 border-b pb-2 mb-4 text-sm uppercase tracking-wider">A. Data Umum</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Tanaman</label>
                        <input required type="text" value={newPlant.jenisTanaman} onChange={e => setNewPlant({...newPlant, jenisTanaman: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm" placeholder="Contoh: Alpukat" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Varietas</label>
                        <input required type="text" value={newPlant.varietas} onChange={e => setNewPlant({...newPlant, varietas: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm" placeholder="Contoh: Miki" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Batang Bawah / Supplier</label>
                        <input type="text" value={newPlant.supplier} onChange={e => setNewPlant({...newPlant, supplier: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm" placeholder="Nama supplier/sumber bibit" />
                      </div>
                      
                      {/* LOKASI */}
                      <div className="sm:col-span-2 grid grid-cols-3 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Subzona</label>
                          <select value={newPlant.subzona} onChange={e => setNewPlant({...newPlant, subzona: e.target.value})} className="w-full p-2 border border-gray-300 rounded-md text-sm">
                            <option>A1</option><option>A2</option><option>B1</option><option>B2</option><option>C1</option><option>C2</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Jalur (No)</label>
                          <input required type="number" value={newPlant.jalur} onChange={e => setNewPlant({...newPlant, jalur: e.target.value})} className="w-full p-2 border border-gray-300 rounded-md text-sm" placeholder="1-999" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Pohon (No)</label>
                          <input required type="number" value={newPlant.noPohon} onChange={e => setNewPlant({...newPlant, noPohon: e.target.value})} className="w-full p-2 border border-gray-300 rounded-md text-sm" placeholder="1-99" />
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Koordinat GPS</label>
                        <div className="flex gap-2">
                          <input type="text" value={newPlant.gps} onChange={e => setNewPlant({...newPlant, gps: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm bg-gray-50" placeholder="-6.200, 106.816" />
                          <button type="button" onClick={getLocation} className="bg-blue-100 text-blue-700 px-3 rounded-lg text-sm font-medium hover:bg-blue-200 whitespace-nowrap flex items-center transition-colors">
                            <MapPin size={16} className="mr-1"/> Ambil GPS
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Tanam</label>
                        <input required type="date" value={newPlant.tglTanam} onChange={e => setNewPlant({...newPlant, tglTanam: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg text-sm" />
                      </div>
                    </div>
                  </div>

                  {/* --- DATA DINAMIS --- */}
                  <div>
                    <h4 className="font-semibold text-green-700 border-b pb-2 mb-4 text-sm uppercase tracking-wider mt-6">B. Data Dinamis</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fase Pertumbuhan</label>
                        <select value={newPlant.fase} onChange={e => setNewPlant({...newPlant, fase: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg text-sm">
                          <option value="TBM">Vegetatif (TBM - Tanaman Belum Menghasilkan)</option>
                          <option value="TM">Generatif (TM - Tanaman Menghasilkan)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status Pohon</label>
                        <select value={newPlant.status} onChange={e => setNewPlant({...newPlant, status: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg text-sm">
                          <option value="Sehat">Sehat</option>
                          <option value="Abnormal">Abnormal / Sakit</option>
                          <option value="Mati">Mati</option>
                          <option value="Tambal Sulam">Tambal Sulam (Replant)</option>
                        </select>
                      </div>

                      {/* TAMPIL JIKA GENERATIF (TM) */}
                      {newPlant.fase === 'TM' && (
                        <div className="sm:col-span-2 bg-purple-50 p-4 rounded-xl border border-purple-100 space-y-3">
                          <h5 className="text-xs font-bold text-purple-800 uppercase tracking-wide">Data Panen</h5>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-purple-900 mb-1">Total Panen Kumulatif (Kg)</label>
                              <input type="number" value={newPlant.panenTotal} onChange={e => setNewPlant({...newPlant, panenTotal: e.target.value})} className="w-full p-2 border border-purple-200 rounded-md text-sm" placeholder="0" />
                            </div>
                            <div className="space-y-1">
                              <label className="block text-xs font-medium text-purple-900">Panen Terakhir</label>
                              <div className="flex gap-1">
                                <input type="date" value={newPlant.panenTgl} onChange={e => setNewPlant({...newPlant, panenTgl: e.target.value})} className="w-1/2 p-2 border border-purple-200 rounded-md text-xs" />
                                <input type="number" value={newPlant.panenVol} onChange={e => setNewPlant({...newPlant, panenVol: e.target.value})} className="w-1/2 p-2 border border-purple-200 rounded-md text-xs" placeholder="Vol (Kg)" />
                              </div>
                            </div>
                            <div className="col-span-2 space-y-1">
                              <label className="block text-xs font-medium text-purple-900">Prediksi Panen Berikutnya</label>
                              <div className="flex gap-2">
                                <input type="month" value={newPlant.prediksiBlnThn} onChange={e => setNewPlant({...newPlant, prediksiBlnThn: e.target.value})} className="w-1/2 p-2 border border-purple-200 rounded-md text-sm" />
                                <input type="number" value={newPlant.prediksiVol} onChange={e => setNewPlant({...newPlant, prediksiVol: e.target.value})} className="w-1/2 p-2 border border-purple-200 rounded-md text-sm" placeholder="Estimasi Volume (Kg)" />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* TAMPIL JIKA TAMBAL SULAM */}
                      {newPlant.status === 'Tambal Sulam' && (
                        <div className="sm:col-span-2 bg-orange-50 p-4 rounded-xl border border-orange-100 grid grid-cols-2 gap-3">
                          <h5 className="text-xs font-bold text-orange-800 uppercase tracking-wide col-span-2">Data Tambal Sulam</h5>
                          <div>
                            <label className="block text-xs font-medium text-orange-900 mb-1">Tgl Tambal Sulam</label>
                            <input type="date" value={newPlant.tsTgl} onChange={e => setNewPlant({...newPlant, tsTgl: e.target.value})} className="w-full p-2 border border-orange-200 rounded-md text-sm" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-orange-900 mb-1">Varietas Baru</label>
                            <input type="text" value={newPlant.tsVarietas} onChange={e => setNewPlant({...newPlant, tsVarietas: e.target.value})} className="w-full p-2 border border-orange-200 rounded-md text-sm" placeholder="Varietas pengganti" />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-xs font-medium text-orange-900 mb-1">Keterangan / Alasan</label>
                            <input type="text" value={newPlant.tsKeterangan} onChange={e => setNewPlant({...newPlant, tsKeterangan: e.target.value})} className="w-full p-2 border border-orange-200 rounded-md text-sm" placeholder="Contoh: Pohon mati terkena jamur akar" />
                          </div>
                        </div>
                      )}

                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ambil Foto Tanaman</label>
                        {!newPlant.photo ? (
                          <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center cursor-pointer hover:bg-green-50 transition-colors">
                            <input type="file" accept="image/*" capture="environment" id="plantCameraInput" className="hidden" onChange={(e) => handlePhotoCapture(e, 'plant')}/>
                            <label htmlFor="plantCameraInput" className="cursor-pointer flex flex-col items-center justify-center w-full h-full">
                              <Camera className="text-green-600 mb-2" size={24} />
                              <span className="text-sm font-medium text-gray-600">Buka Kamera HP</span>
                            </label>
                          </div>
                        ) : (
                          <div className="relative">
                            <img src={newPlant.photo} alt="Preview" className="w-full h-32 object-cover rounded-xl border border-gray-200" />
                            <button type="button" onClick={() => setNewPlant({...newPlant, photo: null})} className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full shadow-sm hover:bg-red-600 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Catatan Lainnya</label>
                        <textarea value={newPlant.notes} onChange={e => setNewPlant({...newPlant, notes: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none resize-none h-16 text-sm" placeholder="Kondisi terkini..."></textarea>
                      </div>

                    </div>
                  </div>
                </form>
              </div>

              <div className="p-4 sm:p-6 border-t border-gray-100 flex justify-end space-x-3 bg-gray-50">
                <button type="button" onClick={() => setShowAddPlant(false)} className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-xl font-medium hover:bg-gray-100 transition-colors">Batal</button>
                <button form="addPlantForm" type="submit" className="px-5 py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 shadow-md flex items-center transition-colors">
                  <Save size={18} className="mr-2"/> Simpan Data
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Modal Tambah Log Aktivitas (Dukungan Kamera HP) */}
        {showAddLog && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0">
              <h3 className="text-xl font-bold text-green-800 mb-4">Catat Aktivitas / Monitoring</h3>
              <form onSubmit={handleAddLog} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Tanaman (Kode - Varietas)</label>
                  <select required value={newLog.plantId} onChange={e => setNewLog({...newLog, plantId: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 bg-white text-sm">
                    <option value="">-- Pilih Tanaman --</option>
                    {plants.map(p => <option key={p.id} value={p.id}>{p.treeCode} - {p.varietas}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Aktivitas</label>
                  <select required value={newLog.type} onChange={e => setNewLog({...newLog, type: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 bg-white">
                    {settings.activityItems.map(item => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>
                
                {/* Input Kamera Native Android */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ambil Foto Bukti</label>
                  {!newLog.photo ? (
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center cursor-pointer hover:bg-green-50 transition-colors">
                      <input type="file" accept="image/*" capture="environment" id="cameraInput" className="hidden" onChange={(e) => handlePhotoCapture(e, 'log')}/>
                      <label htmlFor="cameraInput" className="cursor-pointer flex flex-col items-center justify-center w-full h-full">
                        <Camera className="text-green-600 mb-2" size={28} />
                        <span className="text-sm font-medium text-gray-600">Buka Kamera HP</span>
                      </label>
                    </div>
                  ) : (
                    <div className="relative">
                      <img src={newLog.photo} alt="Preview" className="w-full h-40 object-cover rounded-xl border border-gray-200" />
                      <button type="button" onClick={() => setNewLog({...newLog, photo: null})} className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full shadow-sm hover:bg-red-600 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Catatan Tambahan</label>
                  <textarea value={newLog.notes} onChange={e => setNewLog({...newLog, notes: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 resize-none h-20" placeholder="Kondisi, pupuk yang dipakai, hama..."></textarea>
                </div>
                
                <div className="flex justify-end space-x-3 pt-2">
                  <button type="button" onClick={() => setShowAddLog(false)} className="px-4 py-3 text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors rounded-xl font-medium w-1/3">Batal</button>
                  <button type="submit" className="px-4 py-3 bg-green-600 hover:bg-green-700 transition-colors text-white rounded-xl font-medium flex-1">Simpan Log</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Footer Buddhist Blessing */}
      <footer className="py-8 text-center text-gray-500 text-xs sm:text-sm px-4">
        <p>© 2026 Kebun Maju Agro Indonesia.</p>
        <p className="mt-1 text-green-700/80 italic font-medium tracking-wide">
          "Sabbe Satta Bhavantu Sukhitatta"<br/>
          Semoga semua makhluk berbahagia.
        </p>
      </footer>
      
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}