import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity, Bell, ShieldCheck, Zap } from "lucide-react"; // Iconos clave

interface SentinelLog {
  is_anomaly: boolean;
  score: number;       // Confianza del modelo (float en Python)
  message: string;
  server_timestamp: string; // ISO String generado en el Alerter
}

const socket = io("https://sentinel-demo-7bb0.onrender.com", {
  transports: ["websocket", "polling"], // Forzar websocket primero, caer en polling si es necesario
  path: "/socket.io/", // Path default de socket.io, asegurarse que sea el mismo en server
  reconnection: true,
});


export default function App() {
  const [logs, setLogs] = useState<SentinelLog[]>([]);
  const [toast, setToast] = useState<SentinelLog | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [, setTick] = useState(0); // Para forzar re-render cada minuto

  useEffect(() => {
    socket.on("new_anomaly", (data: SentinelLog) => {
      setLogs((prev) => [data, ...prev].slice(0, 8));
      if (data.is_anomaly) {
        setToast(data);
        setToastVisible(true);
        setTimeout(() => setToastVisible(false), 8000);
      }
    });
    return () => { socket.off("new_anomaly"); };
  }, []);

  // Actualizar el contador de tiempo cada minuto
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(prev => prev + 1);
    }, 60000); // 60 segundos
    
    return () => clearInterval(interval);
  }, []);

  const formatElapsedSince = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMin = Math.max(0, Math.floor(diffMs / 60000));
    if (diffMin < 60) return `${diffMin}m`;
    const hours = Math.floor(diffMin / 60);
    const minutes = diffMin % 60;
    return `${hours}:${minutes.toString().padStart(2, "0")}`;
  };

  const lastAnomaly = logs.find(l => l.is_anomaly);

  return (
    <div className="min-h-screen w-full bg-slate-900 p-6 md:p-10 font-sans text-slate-100">
      <div className="mx-auto w-full max-w-[1600px] space-y-8">
        
        {/* Header con Estado en Vivo */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700 pb-6">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-100 flex items-center gap-3">
              <ShieldCheck className="h-10 w-10 text-blue-400" />
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
          <Card className="shadow-sm border border-slate-700 bg-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-slate-400 text-left w-full">Tiempo desde última alerta</CardTitle>
              <Activity className="h-4 w-4 text-amber-400" />
            </CardHeader>
            <CardContent className="text-left">
              <div className="text-2xl font-bold text-slate-100">{formatElapsedSince(lastAnomaly?.server_timestamp)}</div>
              <p className="text-xs text-slate-400 font-medium">{lastAnomaly ? 'Última anomalía detectada' : 'Sin alertas recientes'}</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border border-slate-700 bg-slate-800 border-l-4 border-l-red-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-slate-400 text-left w-full">Alertas Activas</CardTitle>
              <Bell className="h-4 w-4 text-red-400" />
            </CardHeader>
            <CardContent className="text-left">
              <div className="text-2xl font-bold text-red-400">{logs.filter(l => l.is_anomaly).length}</div>
              <p className="text-xs text-slate-400 font-medium">Anomalías detectadas</p>
            </CardContent>
          </Card>
        </div>

        {/* Sección de Tabla Principal */}
        <Card className="shadow-md border border-slate-700 bg-slate-800 overflow-hidden">
          <CardHeader className="border-b border-slate-700 bg-slate-800/50">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-400 fill-amber-400" />
              <CardTitle className="text-xl text-slate-100">Telemetría en Tiempo Real</CardTitle>
            </div>
            <CardDescription className="text-slate-400">Logs procesados por el pipeline de monitoreo.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-900/50">
                <TableRow className="border-slate-700">
                  <TableHead className="w-[180px] pl-6 text-slate-300">Timestamp</TableHead>
                  <TableHead className="text-slate-300">Mensaje</TableHead>
                  <TableHead className="text-center text-slate-300">Confianza</TableHead>
                  <TableHead className="text-right pr-6 text-slate-300">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow className="border-slate-700">
                    <TableCell colSpan={4} className="h-32 text-center text-slate-500 italic">
                      Esperando datos...
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log, i) => (
                    <TableRow key={i} className="hover:bg-slate-700/50 transition-colors border-slate-700">
                      <TableCell className="font-mono text-xs text-slate-400 pl-6">
                        {new Date(log.server_timestamp || Date.now()).toLocaleTimeString()}
                      </TableCell>
                      <TableCell className="font-medium text-slate-100">{log.message || "Procesando métricas..."}</TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm text-slate-200 bg-slate-700 px-2 py-1 rounded">
                          {(log.score ? log.score * 100 : 95).toFixed(2)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Badge
                          variant={log.is_anomaly ? "destructive" : "outline"}
                          className={log.is_anomaly ? "animate-pulse bg-red-600/90 text-white border-red-500" : "bg-green-900/30 text-green-400 border-green-700"}
                        >
                          {log.is_anomaly ? "Anomalía" : "Estable"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Notificación lateral para alertas */}
        {toastVisible && toast && (
          <div className="fixed right-6 top-20 w-96 bg-slate-800 border-2 border-red-500/50 text-slate-100 rounded-lg shadow-2xl p-4 z-50 animate-in slide-in-from-right">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <div className="rounded-full bg-red-600 p-2">
                  <Bell className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-4">
                  <div className="font-bold text-white">Nueva Anomalía</div>
                  <button onClick={() => setToastVisible(false)} className="text-slate-400 hover:text-slate-200 text-xl leading-none">&times;</button>
                </div>
                <div className="mt-2 text-sm text-slate-300">{toast.message || "Anomalía detectada"}</div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Confianza: {(toast.score ? (toast.score*100).toFixed(2) : '—')}%</span>
                  <span className="text-xs text-slate-500">{new Date(toast.server_timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}