import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { 
  Ticket, Upload, ShieldCheck, CheckCircle2, XCircle, User, Phone, 
  Lock, LogOut, Clock, Image as ImageIcon, ShoppingCart, 
  Copy, Check, Landmark, ChevronDown, ChevronUp, Info, Timer,
  Car, Wine, Tent, Users, Armchair, Badge, Gift, Wifi, Bath, Sparkles, AlertTriangle
} from 'lucide-react';

/* =========================================================================
   CONFIGURACIÓN DE PRODUCCIÓN FIREBASE
   ========================================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyBiSDjhdBCzUk8KtTWHGljk0R21Ov7cCiU",
  authDomain: "rifa-cirque.firebaseapp.com",
  databaseURL: "https://rifa-cirque-default-rtdb.firebaseio.com",
  projectId: "rifa-cirque",
  storageBucket: "rifa-cirque.firebasestorage.app",
  messagingSenderId: "67227236912",
  appId: "1:67227236912:web:6c876ce9eb01045158cbf5"
};

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxfWvgvTtPgK2BFZM7s03xCry4HtGV6Umwu8XUa8QGtwXhlrltQY5TN9Q6mvcvQK_FO/exec";

// =========================================================================

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'rifa-cirque-produccion';

const TOTAL_TICKETS = 70;
const TICKET_PRICE = 10000;
const ADMIN_PASSWORD = 'unda1995'; 
const RESERVATION_TIME_LIMIT = 600; 

const getTicketsCollection = () => collection(db, 'rifas', appId, 'tickets');
const getTicketDoc = (id) => doc(db, 'rifas', appId, 'tickets', id);

const BANK_DETAILS = {
  name: "Carlos UNDA",
  rut: "19.178.119-8",
  email: "carlosundasandoval@gmail.com",
  accountType: "Cuenta Corriente",
  accountNumber: "10013677265",
  bank: "Banco Falabella"
};

const compressImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800; 
        let scaleSize = 1;
        if (img.width > MAX_WIDTH) {
          scaleSize = MAX_WIDTH / img.width;
        }
        canvas.width = img.width * scaleSize;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7)); 
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
};

export default function App() {
  const [user, setUser] = useState(null);
  const [ticketsData, setTicketsData] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null); 
  const [authError, setAuthError] = useState(false);

  const [selectedNumbers, setSelectedNumbers] = useState([]);
  
  // Estados para Admin
  const [adminSelectedTicket, setAdminSelectedTicket] = useState(null);
  const [adminTicketGroup, setAdminTicketGroup] = useState([]);
  
  const [showReserveModal, setShowReserveModal] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showAdminTicketModal, setShowAdminTicketModal] = useState(false);
  const [showBenefits, setShowBenefits] = useState(false);
  const [timeLeft, setTimeLeft] = useState(RESERVATION_TIME_LIMIT);

  const [buyerName, setBuyerName] = useState('');
  const [buyerRut, setBuyerRut] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [receiptImage, setReceiptImage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(''); 
  const [submitError, setSubmitError] = useState(null); 
  
  const [showBankDetails, setShowBankDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState('');

  // 1. Inicializar Autenticación y Título
  useEffect(() => {
    // ESTA LÍNEA CAMBIA EL TÍTULO DE LA PESTAÑA DEL NAVEGADOR
    document.title = "Rifa 2 Entradas Cirque du Soleil";

    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Error de autenticación Firebase:", error);
        setAuthError(true);
        setLoading(false); 
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Cargar Datos en tiempo real
  useEffect(() => {
    if (!user) return;
    
    const unsubscribe = onSnapshot(getTicketsCollection(), (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setTicketsData(data);
        setLoading(false);
        setAuthError(false); 
      },
      (error) => {
        console.error("Error cargando tickets de Firestore:", error);
        setAuthError(true);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [user]);

  // 3. Temporizador
  useEffect(() => {
    let timer;
    if (selectedNumbers.length > 0 && !isAdmin) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setSelectedNumbers([]);
            setShowReserveModal(false);
            setBuyerName('');
            setBuyerRut('');
            setBuyerPhone('');
            setReceiptImage(null);
            setSubmitError(null);
            showNotification("El tiempo de reserva ha expirado.", "error");
            return RESERVATION_TIME_LIMIT;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setTimeLeft(RESERVATION_TIME_LIMIT); 
    }
    return () => clearInterval(timer);
  }, [selectedNumbers.length, isAdmin]);

  const ticketsMap = useMemo(() => {
    return ticketsData.reduce((acc, ticket) => {
      acc[ticket.id] = ticket;
      return acc;
    }, {});
  }, [ticketsData]);

  const conflictingNumbers = selectedNumbers.filter(num => ticketsMap[num] && ticketsMap[num].status !== 'available');
  const hasConflicts = conflictingNumbers.length > 0;

  const showNotification = (msg, type = 'error') => {
    setNotification({ text: msg, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleNumberClick = (number) => {
    const ticketStr = String(number);
    const ticketInfo = ticketsMap[ticketStr];
    const isSelected = selectedNumbers.includes(ticketStr);

    if (isAdmin) {
      if (ticketInfo && (ticketInfo.status === 'reserved' || ticketInfo.status === 'confirmed')) {
        const group = Object.entries(ticketsMap)
          .filter(([id, data]) => {
            const sameReceipt = data.receiptImageUrl && data.receiptImageUrl === ticketInfo.receiptImageUrl;
            const samePerson = data.buyerName === ticketInfo.buyerName && data.buyerRut === ticketInfo.buyerRut;
            return sameReceipt || samePerson;
          })
          .map(([id]) => id);

        setAdminSelectedTicket(ticketStr);
        setAdminTicketGroup(group.sort((a, b) => a - b)); 
        setShowAdminTicketModal(true);
      }
      return;
    }

    if (!ticketInfo || ticketInfo.status === 'available' || isSelected) {
      setSelectedNumbers(prev => {
        if (prev.includes(ticketStr)) return prev.filter(n => n !== ticketStr);
        if (!ticketInfo || ticketInfo.status === 'available') return [...prev, ticketStr];
        return prev;
      });
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const compressedBase64 = await compressImage(file);
      setReceiptImage(compressedBase64);
    }
  };

  const copyBankDetails = () => {
    const textToCopy = `${BANK_DETAILS.name}\n${BANK_DETAILS.rut}\n${BANK_DETAILS.email}\n${BANK_DETAILS.accountType}\n${BANK_DETAILS.accountNumber}\n${BANK_DETAILS.bank}`;
    
    const textArea = document.createElement("textarea");
    textArea.value = textToCopy;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      showNotification("No se pudo copiar al portapapeles", "error");
    }
    document.body.removeChild(textArea);
  };

  const submitReservation = async () => {
    if (!buyerName || !buyerRut || !buyerPhone || !receiptImage) {
      showNotification("Por favor completa todos los datos y sube el comprobante.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setUploadStatus('Verificando disponibilidad...');
    
    try {
      const checks = selectedNumbers.map(async (numStr) => {
        const ticketRef = getTicketDoc(numStr);
        const ticketSnap = await getDoc(ticketRef);
        if (ticketSnap.exists()) {
          const data = ticketSnap.data();
          if (data.status === 'reserved' || data.status === 'confirmed') {
            return numStr; 
          }
        }
        return null; 
      });

      const checkResults = await Promise.all(checks);
      const unavailableNumbers = checkResults.filter(num => num !== null);

      if (unavailableNumbers.length > 0) {
        setIsSubmitting(false);
        setUploadStatus('');
        setSubmitError(`Alguien más acaba de reservar el/los número(s): ${unavailableNumbers.join(', ')}.`);
        return; 
      }

      let driveImageUrl = receiptImage; 
      if (GOOGLE_SCRIPT_URL.includes("script.google.com")) {
        setUploadStatus('Subiendo imagen a Drive...');
        const payload = {
          filename: `Comprobante_${buyerName.replace(/\s+/g, '_')}_Nums_${selectedNumbers.join('-')}.jpg`,
          mimeType: 'image/jpeg',
          base64: receiptImage
        };

        const driveResponse = await fetch(GOOGLE_SCRIPT_URL, {
          method: "POST",
          body: JSON.stringify(payload),
          headers: { "Content-Type": "text/plain;charset=utf-8" }
        });
        
        const driveData = await driveResponse.json();
        if (!driveData.success) throw new Error("Error al guardar la imagen en Drive.");
        driveImageUrl = driveData.url;
      }

      setUploadStatus('Guardando reserva en la base de datos...');
      const promises = selectedNumbers.map(numStr => {
        const ticketRef = getTicketDoc(numStr);
        return setDoc(ticketRef, {
          status: 'reserved',
          buyerName,
          buyerRut,
          buyerPhone,
          receiptImageUrl: driveImageUrl, 
          userId: user.uid,
          reservedAt: new Date().toISOString()
        });
      });

      await Promise.all(promises);
      
      setSelectedNumbers([]);
      setBuyerName('');
      setBuyerRut('');
      setBuyerPhone('');
      setReceiptImage(null);
      setShowBankDetails(false);
      setShowReserveModal(false);
      setSubmitError(null);
      showNotification("¡Reserva completada! Hemos guardado tu comprobante.", "success");
    } catch (error) {
      console.error("Error al reservar:", error);
      showNotification("Hubo un error de conexión al guardar. Intenta nuevamente.");
    } finally {
      setIsSubmitting(false);
      setUploadStatus('');
    }
  };

  const loginAdmin = () => {
    if (adminPassInput === ADMIN_PASSWORD) {
      setIsAdmin(true);
      setShowAdminLogin(false);
      setAdminPassInput('');
      setSelectedNumbers([]);
    } else {
      showNotification("Contraseña incorrecta", "error");
    }
  };

  const approveTicket = async () => {
    try {
      const promises = adminTicketGroup.map(num => {
        const ticketRef = getTicketDoc(num);
        return setDoc(ticketRef, { ...ticketsMap[num], status: 'confirmed' });
      });
      await Promise.all(promises);
      
      setShowAdminTicketModal(false);
      showNotification(`Los números ${adminTicketGroup.join(', ')} fueron aprobados.`, "success");
    } catch (error) {
      console.error("Error al aprobar:", error);
      showNotification("Hubo un error al aprobar.", "error");
    }
  };

  const rejectTicket = async () => {
    try {
      const promises = adminTicketGroup.map(num => {
        const ticketRef = getTicketDoc(num);
        return deleteDoc(ticketRef);
      });
      await Promise.all(promises);

      setShowAdminTicketModal(false);
      showNotification(`Los números ${adminTicketGroup.join(', ')} fueron liberados.`, "success");
    } catch (error) {
      console.error("Error al rechazar:", error);
      showNotification("Hubo un error al liberar.", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 flex-col gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-red-700"></div>
        <p className="text-slate-500 font-medium animate-pulse">Conectando al servidor...</p>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 flex-col gap-4 p-6 text-center">
        <XCircle className="w-16 h-16 text-red-600" />
        <h2 className="text-xl font-bold text-slate-800">Error de Conexión a Base de Datos</h2>
        <p className="text-slate-600 max-w-md">No se pudo conectar a Firebase. Revisa que tu base de datos Firestore esté habilitada con permisos de escritura (Modo de Prueba).</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-24 font-sans relative">
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-4">
          <div className={`px-6 py-3 rounded-full shadow-lg font-medium flex items-center gap-2 ${notification.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
            {notification.type === 'error' ? <XCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            {notification.text}
          </div>
        </div>
      )}

      <header className="bg-[#1a1a1a] text-white shadow-md sticky top-0 z-30 border-b-4 border-red-700">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Ticket className="h-6 w-6 md:h-8 md:w-8 text-red-500" />
            <h1 className="text-lg md:text-xl font-bold tracking-tight uppercase">
              Rifa 2 Entradas <span className="text-red-500 hidden sm:inline">• Cirque du Soleil</span>
            </h1>
          </div>
          <div>
            {isAdmin ? (
              <button onClick={() => setIsAdmin(false)} className="flex items-center gap-2 bg-red-700 hover:bg-red-800 px-3 py-1.5 md:px-4 md:py-2 rounded-lg transition-colors text-sm font-medium">
                <LogOut className="h-4 w-4" /> <span className="hidden md:inline">Salir de Admin</span>
              </button>
            ) : (
              <button onClick={() => setShowAdminLogin(true)} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors p-2" title="Acceso Administrador">
                <Lock className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 mt-6 md:mt-8">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-8 border border-slate-200">
          <div className="bg-gradient-to-r from-red-800 to-red-950 p-6 md:p-8 text-white text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent"></div>
            <h2 className="text-2xl md:text-4xl font-black mb-2 relative z-10 tracking-tight">Rifa 2 Entradas Cirque du Soleil</h2>
            <div className="relative z-10 flex flex-col items-center justify-center gap-2 mt-2">
              <p className="text-red-200 text-lg md:text-xl font-medium flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-500" /> Categoría TAPIS ROUGE <Sparkles className="w-5 h-5 text-yellow-500" />
              </p>
              <span className="inline-block bg-red-900/60 border border-red-700 text-red-100 text-sm md:text-base font-semibold px-4 py-1.5 rounded-full shadow-sm mt-1">
                <b>Fecha función:</b>Viernes 22 de Enero de 2027 • 17:00 HRS. • Espacio Riesco
              </span>
              <span className="inline-block bg-yellow-400 border border-yellow-500 text-red-900 text-base md:text-lg font-black px-5 py-1.5 rounded-full shadow-md mt-2 animate-in zoom-in">
                Valor del número: ${TICKET_PRICE.toLocaleString('es-CL')}
              </span>
            </div>
          </div>

          <div className="p-6">
            <p className="text-slate-700 mb-6 text-sm md:text-base leading-relaxed text-center md:text-left max-w-4xl mx-auto">
              <span className="font-bold text-red-700 text-lg block mb-1">¡Gana una experiencia VIP inolvidable!</span>
              El afortunado ganador de esta rifa obtendrá 2 entradas para el exclusivo sector <span className="font-bold text-slate-800">Tapis Rouge</span>. Vivirás el espectáculo de una forma especial y diferenciada, desde muy cerca del escenario, en un área reservada para solo unas 200 personas por función.
            </p>

            <div className="max-w-4xl mx-auto bg-slate-50 rounded-xl border border-slate-100 overflow-hidden mb-4">
              <button onClick={() => setShowBenefits(!showBenefits)} className="w-full p-4 flex items-center justify-between text-slate-800 font-bold hover:bg-slate-100 transition-colors">
                <span className="flex items-center gap-2">
                  <StarIcon className="w-5 h-5 text-yellow-500" /> 
                  Tu premio incluye los siguientes beneficios
                </span>
                {showBenefits ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </button>

              {showBenefits && (
                <div className="p-5 pt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 animate-in slide-in-from-top-2">
                  <BenefitItem icon={<Car />} text="Estacionamiento preferencial" />
                  <BenefitItem icon={<Wine />} text="Servicio de coctelería con menú especial" />
                  <BenefitItem icon={<Tent />} text="Ingreso a carpa exclusiva, ambientada" />
                  <BenefitItem icon={<Users />} text="Equipo exclusivo de servicio" />
                  <BenefitItem icon={<Armchair />} text="Asientos privilegiados" />
                  <BenefitItem icon={<Badge />} text="Credencial de acceso exclusivo" />
                  <BenefitItem icon={<Gift />} text="Regalo especial del Tapis Rouge" />
                  <BenefitItem icon={<Wifi />} text="Wi-Fi gratuito" />
                  <BenefitItem icon={<Bath />} text="Baños privados" />
                </div>
              )}
            </div>

            <div className="max-w-4xl mx-auto mt-4 text-xs text-slate-500 bg-slate-50/50 p-3 rounded-lg flex items-start gap-2 mb-3">
              <Info className="w-4 h-4 shrink-0 mt-0.5 opacity-70" />
              <p className="leading-relaxed">
                <strong>Nota de Transparencia:</strong> Esta rifa es organizada de forma estrictamente particular e independiente. No está afiliada, patrocinada, ni respaldada por Cirque du Soleil, PuntoTicket, Banco de Chile ni sus productoras asociadas. Puedes revisar los detalles del 
                <a href="https://www.puntoticket.com/cirque-du-soleil-alegria" target="_blank" rel="noopener noreferrer" className="text-red-700 hover:text-red-800 font-medium hover:underline ml-1">
                  evento oficial aquí
                </a>.
              </p>
            </div>

            <div className="max-w-4xl mx-auto bg-slate-800 text-slate-200 rounded-lg p-4 flex items-start gap-3 shadow-inner">
              <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-sm leading-relaxed">
                <span className="font-bold text-white block mb-0.5">Condiciones del Sorteo:</span> 
                Si hasta el <strong>27 de agosto de 2026</strong> no se logra vender la totalidad de los {TOTAL_TICKETS} números, el plazo de la rifa se extenderá un mes más, hasta el <strong>27 de septiembre de 2026</strong>. Para que el sorteo se lleve a cabo de manera efectiva en cualquiera de las fechas, se requerirá un mínimo de <strong>50 números vendidos</strong>.
              </p>
            </div>

            <hr className="my-8 border-slate-100" />

            <div className="text-center">
              <h3 className="text-lg font-bold mb-4 text-slate-800">
                {isAdmin ? 'Panel de Administración' : '¡Selecciona tus números de la suerte!'}
              </h3>
              
              <div className="flex flex-wrap justify-center gap-4 md:gap-6 text-xs md:text-sm font-medium">
                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-white border-2 border-slate-300 shadow-sm"></div><span>Disponible</span></div>
                {!isAdmin && <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-red-50 border-2 border-red-500 shadow-sm"></div><span>Seleccionado</span></div>}
                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-amber-200 border-2 border-amber-400 shadow-sm"></div><span>Pendiente pago</span></div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-slate-800 border-2 border-slate-900 shadow-sm"></div><span className="text-slate-700">Vendido</span></div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 md:gap-3 bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100">
          {Array.from({ length: TOTAL_TICKETS }, (_, i) => i + 1).map((num) => {
            const ticketStr = String(num);
            const info = ticketsMap[ticketStr];
            const status = info ? info.status : 'available';
            const isSelected = selectedNumbers.includes(ticketStr);

            let baseClasses = "relative w-full aspect-square rounded-xl flex items-center justify-center font-bold text-base md:text-xl transition-all shadow-sm border-2 cursor-pointer select-none ";
            
            if (isSelected && conflictingNumbers.includes(ticketStr)) {
              baseClasses += "bg-rose-200 border-red-600 text-red-800 ring-4 ring-red-400 scale-105 shadow-md z-10 animate-pulse";
            } else if (isSelected) {
              baseClasses += "bg-red-50 border-red-600 text-red-700 ring-4 ring-red-100 scale-105 shadow-md z-10";
            } else if (status === 'available') {
              baseClasses += "bg-white border-slate-200 text-slate-700 hover:border-red-400 hover:shadow-md hover:-translate-y-0.5";
            } else if (status === 'reserved') {
              baseClasses += "bg-amber-100 border-amber-400 text-amber-800";
              if (isAdmin) baseClasses += " hover:bg-amber-200 ring-2 ring-amber-500 ring-offset-1";
              else baseClasses += " opacity-80 cursor-not-allowed";
            } else if (status === 'confirmed') {
              baseClasses += "bg-slate-800 border-slate-900 text-white opacity-95";
              if (isAdmin) baseClasses += " hover:bg-slate-700 cursor-pointer";
              else baseClasses += " cursor-not-allowed";
            }

            return (
              <div key={num} onClick={() => handleNumberClick(num)} className={baseClasses}>
                {num}
                {status === 'reserved' && !isSelected && <Clock className="absolute top-1 right-1 h-3 w-3 opacity-60" />}
                {status === 'confirmed' && !isSelected && <ShieldCheck className="absolute top-1 right-1 h-3 w-3 text-red-400" />}
                {isSelected && <CheckCircle2 className="absolute -top-1 -right-1 h-5 w-5 text-red-600 bg-white rounded-full" />}
              </div>
            );
          })}
        </div>
        
        {selectedNumbers.length > 0 && !isAdmin && <div className="h-52 sm:h-28 w-full transition-all duration-300"></div>}
      </main>

      {/* BARRA FLOTANTE */}
      {selectedNumbers.length > 0 && !isAdmin && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-10px_25px_-5px_rgba(0,0,0,0.1)] z-40 animate-in slide-in-from-bottom-full p-4">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
              <div className="flex items-center gap-3">
                <div className="bg-red-100 text-red-700 p-2.5 rounded-full"><ShoppingCart className="h-6 w-6" /></div>
                <div>
                  <p className="font-bold text-slate-800">{selectedNumbers.length} {selectedNumbers.length === 1 ? 'número' : 'números'} <span className="text-red-600 ml-1">(${ (selectedNumbers.length * TICKET_PRICE).toLocaleString('es-CL') })</span></p>
                  <p className="text-sm text-slate-500 max-w-[120px] truncate">N°: {selectedNumbers.sort((a,b)=>a-b).join(', ')}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100 sm:ml-4">
                <Timer className="w-4 h-4 animate-pulse" /><span className="font-mono font-bold tracking-tight">{formatTime(timeLeft)}</span>
              </div>
            </div>
            <button 
              onClick={() => setShowReserveModal(true)} 
              disabled={hasConflicts}
              className={`w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold shadow-lg transition-all text-lg ${hasConflicts ? 'bg-slate-400 text-slate-200 cursor-not-allowed' : 'bg-red-700 hover:bg-red-800 text-white active:scale-95'}`}
            >
              {hasConflicts ? 'Revisa tu selección' : 'Completar Reserva'}
            </button>
          </div>
        </div>
      )}

      {/* MODAL ADMIN */}
      {showAdminLogin && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><ShieldCheck className="text-slate-800" /> Acceso Admin</h3>
            <input type="password" placeholder="Contraseña" className="w-full border border-slate-300 rounded-lg p-3 mb-4 focus:ring-2 focus:ring-slate-800 outline-none" value={adminPassInput} onChange={(e) => setAdminPassInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loginAdmin()} />
            <div className="flex gap-3">
              <button onClick={() => setShowAdminLogin(false)} className="flex-1 py-2 rounded-lg font-medium text-slate-600 hover:bg-slate-100 transition">Cancelar</button>
              <button onClick={loginAdmin} className="flex-1 py-2 rounded-lg font-medium bg-slate-800 text-white hover:bg-slate-900 transition">Entrar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RESERVA */}
      {showReserveModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden my-4 md:my-8 flex flex-col max-h-[90vh]">
            <div className="bg-[#1a1a1a] p-5 text-white text-center shrink-0 border-b-4 border-red-700">
              <h3 className="text-xl font-bold uppercase tracking-wide">Completar Reserva</h3>
              <p className="text-yellow-400 font-black text-xl mt-2 mb-1">Total a pagar: ${ (selectedNumbers.length * TICKET_PRICE).toLocaleString('es-CL') }</p>
              <p className="text-slate-300 text-sm mt-1 font-medium">
                Estás reservando {selectedNumbers.length} {selectedNumbers.length === 1 ? 'número' : 'números'}: <span className="text-red-400 font-bold">{selectedNumbers.sort((a,b)=>a-b).join(', ')}</span>
              </p>
            </div>
            
            <div className="p-5 overflow-y-auto space-y-6">
              {(hasConflicts || submitError) && (
                <div className="bg-red-50 border-l-4 border-red-600 p-4 rounded-r-xl shadow-sm animate-in fade-in">
                  <div className="flex items-start gap-3">
                    <XCircle className="w-6 h-6 text-red-600 shrink-0" />
                    <div>
                      <h4 className="text-red-800 font-bold">¡Número ya no disponible!</h4>
                      <p className="text-red-700 text-sm mt-1 leading-relaxed">
                        {submitError ? submitError : `Alguien más se te adelantó y reservó el/los número(s): ${conflictingNumbers.join(', ')}.`} 
                        <br/><span className="font-bold block mt-2">Por favor, cierra esta ventana, desmarca los ocupados en el panel y vuelve a intentarlo. Tus datos seguirán aquí.</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-xl overflow-hidden shadow-sm">
                <button onClick={() => setShowBankDetails(!showBankDetails)} className="w-full p-4 flex items-center justify-between text-blue-900 font-bold hover:bg-blue-100 transition-colors">
                  <div className="flex items-center gap-2"><Landmark className="w-5 h-5 text-blue-700" />Ver cuenta para transferir</div>
                  {showBankDetails ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
                {showBankDetails && (
                  <div className="p-4 pt-0 text-sm text-slate-700 animate-in slide-in-from-top-2">
                    <div className="mb-2 bg-blue-100/50 text-blue-800 text-center font-bold py-1.5 rounded-lg border border-blue-200">Monto exacto a transferir: ${ (selectedNumbers.length * TICKET_PRICE).toLocaleString('es-CL') }</div>
                    <div className="space-y-1.5 mb-3 bg-white p-4 rounded-lg border border-blue-100 whitespace-pre-line font-mono text-xs md:text-sm text-slate-800 shadow-inner">
                      {`${BANK_DETAILS.name}\n${BANK_DETAILS.rut}\n${BANK_DETAILS.email}\n${BANK_DETAILS.accountType}\n${BANK_DETAILS.accountNumber}\n${BANK_DETAILS.bank}`}
                    </div>
                    <button onClick={copyBankDetails} className={`w-full py-2.5 rounded-lg flex items-center justify-center gap-2 font-bold transition-colors mb-2 ${copied ? 'bg-emerald-500 text-white shadow-md' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'}`}>
                      {copied ? <><Check className="w-4 h-4" /> ¡Datos copiados!</> : <><Copy className="w-4 h-4" /> Copiar datos</>}
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-col gap-4 text-amber-900 text-sm shadow-sm">
                <div className="flex gap-3">
                  <div className="shrink-0 mt-0.5 text-amber-600"><Info className="w-6 h-6" /></div>
                  <p className="leading-relaxed"><span className="font-black text-amber-800 uppercase text-xs tracking-wider block mb-1">Paso Obligatorio</span> Al transferir, incluye los números <span className="font-bold bg-amber-200 px-1.5 py-0.5 rounded text-amber-900">{selectedNumbers.sort((a,b)=>a-b).join(', ')}</span> en el mensaje o comentario.</p>
                </div>
                <div className="flex items-center gap-2 bg-white/60 p-2.5 rounded-lg border border-amber-200 justify-center">
                  <Timer className={`w-5 h-5 ${timeLeft < 60 ? 'text-rose-600 animate-pulse' : 'text-amber-700'}`} />
                  <p className="font-medium text-amber-800">Tienes <span className={`font-bold ${timeLeft < 60 ? 'text-rose-600' : ''}`}>{formatTime(timeLeft)}</span> para subir tu comprobante.</p>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <h4 className="font-bold text-slate-800 border-b-2 border-slate-100 pb-2 flex items-center gap-2"><User className="w-5 h-5 text-slate-400" /> Datos Personales</h4>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nombre Completo</label>
                  <input type="text" className="w-full border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none bg-slate-50 focus:bg-white transition-all" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">RUT</label>
                  <input type="text" className="w-full border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none bg-slate-50 focus:bg-white transition-all" value={buyerRut} onChange={(e) => setBuyerRut(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Teléfono</label>
                  <input type="tel" className="w-full border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none bg-slate-50 focus:bg-white transition-all" value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Comprobante de Transferencia</label>
                  <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-red-50 hover:border-red-300 transition-all overflow-hidden relative group">
                    {receiptImage ? (
                      <div className="relative w-full h-full">
                        <img src={receiptImage} alt="Comprobante" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><span className="text-white font-medium bg-black/50 px-3 py-1 rounded-lg flex items-center gap-2"><Upload className="w-4 h-4"/> Cambiar imagen</span></div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <div className="bg-white p-3 rounded-full shadow-sm mb-3 border border-slate-100 text-slate-400 group-hover:text-red-500 transition-transform"><ImageIcon className="w-6 h-6" /></div>
                        <p className="text-sm text-slate-600 text-center px-4">Haz clic para <span className="font-bold text-red-600">subir tu captura</span></p>
                      </div>
                    )}
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                  </label>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-3 shrink-0 flex-col sm:flex-row">
              {isSubmitting && <div className="text-sm font-medium text-red-600 w-full text-center sm:hidden animate-pulse mb-2">{uploadStatus}</div>}
              <button onClick={() => {
                  setShowReserveModal(false);
                  setSubmitError(null);
                }} className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 transition shadow-sm">
                Volver
              </button>
              <button 
                onClick={submitReservation} 
                disabled={isSubmitting || hasConflicts} 
                className={`flex-[2] py-3 rounded-xl font-bold text-white transition shadow-md text-lg relative overflow-hidden ${isSubmitting || hasConflicts ? 'bg-slate-400 cursor-not-allowed' : 'bg-red-700 hover:bg-red-800 active:scale-95'}`}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2"><div className="w-5 h-5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div> {uploadStatus || 'Guardando...'}</span>
                ) : 'Confirmar Reserva'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ADMIN - REVISAR TICKET EN BLOQUE */}
      {showAdminTicketModal && isAdmin && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl my-8 overflow-hidden">
            <div className={`p-5 text-white text-center relative ${ticketsMap[adminSelectedTicket]?.status === 'confirmed' ? 'bg-slate-800' : 'bg-amber-500'}`}>
              <h3 className="text-xl font-bold">Gestión de Compra en Bloque</h3>
              <p className="text-sm opacity-90 mt-1 font-medium">Estado: {ticketsMap[adminSelectedTicket]?.status === 'confirmed' ? 'Confirmados' : 'Pendientes de Aprobación'}</p>
            </div>
            <div className="p-6">
              
              <div className="bg-amber-50 border-l-4 border-amber-500 p-3 mb-6 rounded-r-lg">
                <p className="text-amber-900 font-bold text-sm mb-1">Números de esta compra ({adminTicketGroup.length}):</p>
                <div className="flex flex-wrap gap-2">
                  {adminTicketGroup.map(num => (
                    <span key={num} className="bg-amber-200 text-amber-900 px-2 py-1 rounded font-bold text-xs">{num}</span>
                  ))}
                </div>
              </div>

              <div className="space-y-0 mb-6 bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex justify-between items-center text-sm border-b border-slate-200 p-3 bg-white">
                  <span className="text-slate-500 font-medium">Comprador:</span><span className="font-bold text-slate-800">{ticketsMap[adminSelectedTicket]?.buyerName}</span>
                </div>
                <div className="flex justify-between items-center text-sm border-b border-slate-200 p-3">
                  <span className="text-slate-500 font-medium">RUT:</span><span className="font-semibold text-slate-800">{ticketsMap[adminSelectedTicket]?.buyerRut}</span>
                </div>
                <div className="flex justify-between items-center text-sm p-3 bg-white">
                  <span className="text-slate-500 font-medium">Teléfono:</span><span className="font-semibold text-slate-800">{ticketsMap[adminSelectedTicket]?.buyerPhone}</span>
                </div>
                <div className="flex justify-between items-center text-sm p-3 border-t border-slate-200 bg-emerald-50">
                  <span className="text-slate-500 font-medium">Pago esperado:</span><span className="font-black text-emerald-700">${(adminTicketGroup.length * TICKET_PRICE).toLocaleString('es-CL')}</span>
                </div>
              </div>
              
              {ticketsMap[adminSelectedTicket]?.receiptImageUrl ? (
                <div className="mb-6">
                  <p className="text-sm font-bold text-slate-700 mb-2">Enlace del comprobante (Drive):</p>
                  <a href={ticketsMap[adminSelectedTicket].receiptImageUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full py-3 bg-blue-50 text-blue-700 font-bold border border-blue-200 rounded-xl hover:bg-blue-100 transition shadow-sm">
                    <ImageIcon className="w-5 h-5"/> Ver foto en Google Drive
                  </a>
                </div>
              ) : ticketsMap[adminSelectedTicket]?.receiptImage ? (
                <div className="mb-6">
                  <p className="text-sm font-bold text-slate-700 mb-2">Comprobante antiguo (Local):</p>
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-100 max-h-72 flex justify-center shadow-inner">
                    <img src={ticketsMap[adminSelectedTicket].receiptImage} alt="Recibo" className="max-w-full object-contain" />
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-100 text-slate-500 text-center rounded-xl mb-6 text-sm border border-slate-200">Sin comprobante adjunto.</div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setShowAdminTicketModal(false)} className="px-4 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition border border-transparent">Cerrar</button>
                <div className="flex-1 flex gap-2 justify-end">
                  <button onClick={rejectTicket} className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-red-700 bg-red-50 hover:bg-red-100 transition border border-red-200 w-full sm:w-auto shadow-sm">
                    <XCircle className="w-5 h-5" /> Liberar Todos
                  </button>
                  {ticketsMap[adminSelectedTicket]?.status !== 'confirmed' && (
                    <button onClick={approveTicket} className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition border border-emerald-200 shadow-sm w-full sm:w-auto">
                      <CheckCircle2 className="w-5 h-5" /> Aprobar Todos
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BenefitItem({ icon, text }) {
  return (
    <div className="flex items-start gap-3 bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
      <div className="text-red-700 shrink-0 mt-0.5">{React.cloneElement(icon, { className: 'w-5 h-5' })}</div>
      <p className="text-sm font-medium text-slate-700">{text}</p>
    </div>
  );
}

function StarIcon({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
    </svg>
  );
}