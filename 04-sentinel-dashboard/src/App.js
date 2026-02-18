"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = App;
var react_1 = require("react");
var socket_io_client_1 = require("socket.io-client");
var table_1 = require("@/components/ui/table");
var badge_1 = require("@/components/ui/badge");
var card_1 = require("@/components/ui/card");
var lucide_react_1 = require("lucide-react"); // Iconos clave
var socket = (0, socket_io_client_1.io)("https://sentinel-demo-7bb0.onrender.com");
function App() {
    var _a = (0, react_1.useState)([]), logs = _a[0], setLogs = _a[1];
    var _b = (0, react_1.useState)(null), toast = _b[0], setToast = _b[1];
    var _c = (0, react_1.useState)(false), toastVisible = _c[0], setToastVisible = _c[1];
    var _d = (0, react_1.useState)(0), setTick = _d[1]; // Para forzar re-render cada minuto
    (0, react_1.useEffect)(function () {
        socket.on("new_anomaly", function (data) {
            setLogs(function (prev) { return __spreadArray([data], prev, true).slice(0, 8); });
            if (data.is_anomaly) {
                setToast(data);
                setToastVisible(true);
                setTimeout(function () { return setToastVisible(false); }, 8000);
            }
        });
        return function () { socket.off("new_anomaly"); };
    }, []);
    // Actualizar el contador de tiempo cada minuto
    (0, react_1.useEffect)(function () {
        var interval = setInterval(function () {
            setTick(function (prev) { return prev + 1; });
        }, 60000); // 60 segundos
        return function () { return clearInterval(interval); };
    }, []);
    var formatElapsedSince = function (dateStr) {
        if (!dateStr)
            return "—";
        var diffMs = Date.now() - new Date(dateStr).getTime();
        var diffMin = Math.max(0, Math.floor(diffMs / 60000));
        if (diffMin < 60)
            return "".concat(diffMin, "m");
        var hours = Math.floor(diffMin / 60);
        var minutes = diffMin % 60;
        return "".concat(hours, ":").concat(minutes.toString().padStart(2, "0"));
    };
    var lastAnomaly = logs.find(function (l) { return l.is_anomaly; });
    return (<div className="min-h-screen w-full bg-slate-900 p-6 md:p-10 font-sans text-slate-100">
      <div className="mx-auto w-full max-w-[1600px] space-y-8">
        
        {/* Header con Estado en Vivo */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700 pb-6">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-100 flex items-center gap-3">
              <lucide_react_1.ShieldCheck className="h-10 w-10 text-blue-400"/>
              Sentinel AI <span className="text-blue-400">Monitor</span>
            </h1>
            <p className="text-slate-400 mt-1">Vigilancia de anomalías en tiempo real</p>
          </div>
          <div className="flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-full border border-slate-700 shadow-sm w-fit">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span className="text-sm font-medium text-slate-200">Sistema en Vivo</span>
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <card_1.Card className="shadow-sm border border-slate-700 bg-slate-800">
            <card_1.CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <card_1.CardTitle className="text-sm font-medium text-slate-400 text-left w-full">Tiempo desde última alerta</card_1.CardTitle>
              <lucide_react_1.Activity className="h-4 w-4 text-amber-400"/>
            </card_1.CardHeader>
            <card_1.CardContent className="text-left">
              <div className="text-2xl font-bold text-slate-100">{formatElapsedSince(lastAnomaly === null || lastAnomaly === void 0 ? void 0 : lastAnomaly.server_timestamp)}</div>
              <p className="text-xs text-slate-400 font-medium">{lastAnomaly ? 'Última anomalía detectada' : 'Sin alertas recientes'}</p>
            </card_1.CardContent>
          </card_1.Card>

          <card_1.Card className="shadow-sm border border-slate-700 bg-slate-800 border-l-4 border-l-red-500">
            <card_1.CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <card_1.CardTitle className="text-sm font-medium text-slate-400 text-left w-full">Alertas Activas</card_1.CardTitle>
              <lucide_react_1.Bell className="h-4 w-4 text-red-400"/>
            </card_1.CardHeader>
            <card_1.CardContent className="text-left">
              <div className="text-2xl font-bold text-red-400">{logs.filter(function (l) { return l.is_anomaly; }).length}</div>
              <p className="text-xs text-slate-400 font-medium">Anomalías detectadas</p>
            </card_1.CardContent>
          </card_1.Card>
        </div>

        {/* Sección de Tabla Principal */}
        <card_1.Card className="shadow-md border border-slate-700 bg-slate-800 overflow-hidden">
          <card_1.CardHeader className="border-b border-slate-700 bg-slate-800/50">
            <div className="flex items-center gap-2">
              <lucide_react_1.Zap className="h-5 w-5 text-amber-400 fill-amber-400"/>
              <card_1.CardTitle className="text-xl text-slate-100">Telemetría en Tiempo Real</card_1.CardTitle>
            </div>
            <card_1.CardDescription className="text-slate-400">Logs procesados por el pipeline de monitoreo.</card_1.CardDescription>
          </card_1.CardHeader>
          <card_1.CardContent className="p-0">
            <table_1.Table>
              <table_1.TableHeader className="bg-slate-900/50">
                <table_1.TableRow className="border-slate-700">
                  <table_1.TableHead className="w-[180px] pl-6 text-slate-300">Timestamp</table_1.TableHead>
                  <table_1.TableHead className="text-slate-300">Mensaje</table_1.TableHead>
                  <table_1.TableHead className="text-center text-slate-300">Confianza</table_1.TableHead>
                  <table_1.TableHead className="text-right pr-6 text-slate-300">Estado</table_1.TableHead>
                </table_1.TableRow>
              </table_1.TableHeader>
              <table_1.TableBody>
                {logs.length === 0 ? (<table_1.TableRow className="border-slate-700">
                    <table_1.TableCell colSpan={4} className="h-32 text-center text-slate-500 italic">
                      Esperando datos...
                    </table_1.TableCell>
                  </table_1.TableRow>) : (logs.map(function (log, i) { return (<table_1.TableRow key={i} className="hover:bg-slate-700/50 transition-colors border-slate-700">
                      <table_1.TableCell className="font-mono text-xs text-slate-400 pl-6">
                        {new Date(log.server_timestamp || Date.now()).toLocaleTimeString()}
                      </table_1.TableCell>
                      <table_1.TableCell className="font-medium text-slate-100">{log.message || "Procesando métricas..."}</table_1.TableCell>
                      <table_1.TableCell className="text-center">
                        <span className="text-sm text-slate-200 bg-slate-700 px-2 py-1 rounded">
                          {(log.score ? log.score * 100 : 95).toFixed(2)}%
                        </span>
                      </table_1.TableCell>
                      <table_1.TableCell className="text-right pr-6">
                        <badge_1.Badge variant={log.is_anomaly ? "destructive" : "outline"} className={log.is_anomaly ? "animate-pulse bg-red-600/90 text-white border-red-500" : "bg-green-900/30 text-green-400 border-green-700"}>
                          {log.is_anomaly ? "Anomalía" : "Estable"}
                        </badge_1.Badge>
                      </table_1.TableCell>
                    </table_1.TableRow>); }))}
              </table_1.TableBody>
            </table_1.Table>
          </card_1.CardContent>
        </card_1.Card>

        {/* Notificación lateral para alertas */}
        {toastVisible && toast && (<div className="fixed right-6 top-20 w-96 bg-slate-800 border-2 border-red-500/50 text-slate-100 rounded-lg shadow-2xl p-4 z-50 animate-in slide-in-from-right">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <div className="rounded-full bg-red-600 p-2">
                  <lucide_react_1.Bell className="h-5 w-5 text-white"/>
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-4">
                  <div className="font-bold text-white">Nueva Anomalía</div>
                  <button onClick={function () { return setToastVisible(false); }} className="text-slate-400 hover:text-slate-200 text-xl leading-none">&times;</button>
                </div>
                <div className="mt-2 text-sm text-slate-300">{toast.message || "Anomalía detectada"}</div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Confianza: {(toast.score ? (toast.score * 100).toFixed(2) : '—')}%</span>
                  <span className="text-xs text-slate-500">{new Date(toast.server_timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          </div>)}
      </div>
    </div>);
}
