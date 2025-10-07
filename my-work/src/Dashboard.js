import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Cell, LineChart, Line, AreaChart, Area, } from 'recharts';

export default function Dashboard() {
// arquivos raw
    const [file1, setFile1] = useState(null); // Estatísticas de Ramal
    const [file2, setFile2] = useState(null); // Top 10 Requerentes
    const [file3, setFile3] = useState(null); // Chamados ServiceAide


    // dados processados
    const [ramalData, setRamalData] = useState([]);
    const [requerentesData, setRequerentesData] = useState([]);
    const [serviceData, setServiceData] = useState([]);


    // filtros
    const [agentFilter, setAgentFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // util: limpeza de strings para comparar nomes/ramais
        const keyify = (s) => (s || '').toString().trim().toLowerCase();

            function parseCSVFile(file, onComplete) {
                if (!file) return;
                Papa.parse(file, {
                    header: true,
                    skipEmptyLines: true,
                    dynamicTyping: false,
                    complete: (results) => {
                        onComplete(results.data);
                },
                error: (err) => {
                    console.error('Erro ao parsear CSV', err);
                    onComplete([]);
                },
            });
        }

        // handlers de upload
        const handleUpload1 = (e) => {
            const f = e.target.files[0];
            setFile1(f);
            parseCSVFile(f, (data) => {
            // map para garantir campos esperados
                const mapped = data.map((row) => ({
                    ramal: row['Ramal do Agente'] ?? row['Ramal'] ?? row['ramal do agente'] ?? row['ramal'] ?? '',
                    entradaAtendidas: Number(row['Entrada Atendidas'] ?? row['EntradaAtendidas'] ?? row['entrada atendidas'] ?? row['entrada_atendidas'] ?? 0) || 0,
                    entradaNaoAtendidas: Number(row['Entrada Não Atendidas'] ?? row['EntradaNaoAtendidas'] ?? row['entrada nao atendidas'] ?? row['entrada_nao_atendidas'] ?? 0) || 0,
                    saidaAtendidas: Number(row['Saída Atendidas'] ?? row['Saida Atendidas'] ?? row['saidaAtendidas'] ?? 0) || 0,
                    saidaNaoAtendidas: Number(row['Saída Não Atendidas'] ?? row['SaidaNaoAtendidas'] ?? row['saida_nao_atendidas'] ?? 0) || 0,
                    totalAtendidas: Number(row['Total Atendidas'] ?? row['TotalAtendidas'] ?? 0) || 0,
                    totalNaoAtendidas: Number(row['Total Não Atendidas'] ?? row['TotalNaoAtendidas'] ?? 0) || 0,
                    totalConversas: Number(row['Total de Conversas'] ?? row['TotalConversas'] ?? row['total conversas'] ?? 0) || 0,
                }));
                setRamalData(mapped);
            });
        };

        const handleUpload2 = (e) => {
            const f = e.target.files[0];
            setFile2(f);
            parseCSVFile(f, (data) => {
                const mapped = data.map((row) => ({
                    nome: row['Nome'] ?? row['nome'] ?? row['Name'] ?? '',
                    quantidade: Number(row['Quantidade'] ?? row['quantidade'] ?? row['Quantity'] ?? 0) || 0,
                }));
                setRequerentesData(mapped);
            });
        };

        const handleUpload3 = (e) => {
            const f = e.target.files[0];
            setFile3(f);
            parseCSVFile(f, (data) => {
                const mapped = data.map((row) => ({
                    nome: row['Nome'] ?? row['nome'] ?? '',
                    categoria: row['Categoria'] ?? row['categoria'] ?? '',
                    dataCriacao: row['Data de Criação'] ?? row['Data de Criacao'] ?? row['data de criação'] ?? row['data'] ?? '',
                    dataUltimoEncerramento: row['Data Último Encerramento'] ?? row['Data Ultimo Encerramento'] ?? row['data ultimo encerramento'] ?? '',
                }));
                setServiceData(mapped);
            });
        };

        // agregações e cruzamentos (memoizados)
        const agentsComparison = useMemo(() => {
            // mapa de requerentes por nome
            const reqMap = {};
            (requerentesData || []).forEach((r) => {
                const k = keyify(r.nome);
                reqMap[k] = (reqMap[k] || 0) + (Number(r.quantidade) || 0);
            });


        // conte chamdos ServiceAide por nome (aplicando possivel filtro de data)
        const svcMap = {};
        const df = dateFrom ? new Date(dateFrom) : null;
        const dt = dateTo ? new Date(dateTo) : null;
        (serviceData || []).forEach((s) => {
            if (!s.nome) return;
            let include = true;
            if (df || dt) {
                const parsed = parseDateFlexible(s.dataCriacao);
                if (!parsed) include = false;
                else {
                    if (df && parsed < df) include = false;
                    if (dt && parsed > dt) include = false;
                }
            }
            if (!include) return;
            const k = keyify(s.nome);
            svcMap[k] = (svcMap[k] || 0) + 1;
        });


        // merge por ramal
        const rows = (ramalData || []).map((a) => {
            const k = keyify(a.ramal);
            const entradaAtend = Number(a.entradaAtendidas || 0);
            const qtdReq = reqMap[k] || 0;
            const svcCount = svcMap[k] || 0;
            const status = entradaAtend === qtdReq && qtdReq === svcCount ? 'OK' : 'Divergente';
            return {
                ramal: a.ramal,
                entradaAtendidas: entradaAtend,
                quantidadeRequerentes: qtdReq,
                chamadosServiceAide: svcCount,
                totalConversas: Number(a.totalConversas || 0),
                totalAtendidas: Number(a.totalAtendidas || 0) || Number(a.totalAtendidas || 0),
                totalNaoAtendidas: Number(a.totalNaoAtendidas || 0) || Number(a.totalNaoAtendidas || 0),
                status,
            };
        });

        return rows;
    }, [ramalData, requerentesData, serviceData, dateFrom, dateTo]);

    // Top 10 agentes por Total de Conversas
    const top10ByConversas = useMemo(() => {
    return [...(ramalData || [])]
        .sort((a, b) => (Number(b.totalConversas || 0) - Number(a.totalConversas || 0)))
        .slice(0, 10)
        .map((r) => ({ name: r.ramal || '—', value: Number(r.totalConversas || 0) }));
    }, [ramalData]);

    // Distribuição de Chamados por Categoria
    const chamadosPorCategoria = useMemo(() => {
        const map = {};
        (serviceData || []).forEach((s) => {
            // aplica filtro de data
            let include = true;
            const df = dateFrom ? new Date(dateFrom) : null;
            const dt = dateTo ? new Date(dateTo) : null;
            if (df || dt) {
                const parsed = parseDateFlexible(s.dataCriacao);
                if (!parsed) include = false;
                else {
                    if (df && parsed < df) include = false;
                    if (dt && parsed > dt) include = false;
            }
        }
        if (!include) return;


        const cat = s.categoria || 'Sem Categoria';
        map[cat] = (map[cat] || 0) + 1;
        });
        return Object.entries(map).map(([categoria, count]) => ({ categoria, count }));
    }, [serviceData, dateFrom, dateTo]);

    // Evolução por Data de Criação
    const evolucaoPorData = useMemo(() => {
        const map = {};
        (serviceData || []).forEach((s) => {
        const parsed = parseDateFlexible(s.dataCriacao);
        if (!parsed) return;
        // aplica filtros
        const df = dateFrom ? new Date(dateFrom) : null;
        const dt = dateTo ? new Date(dateTo) : null;
        if (df && parsed < df) return;
        if (dt && parsed > dt) return;

        const key = parsed.toISOString().slice(0, 10); // YYYY-MM-DD
        map[key] = (map[key] || 0) + 1;
    });
    const arr = Object.entries(map)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => (a.date > b.date ? 1 : -1));
    return arr;
    }, [serviceData, dateFrom, dateTo]);


    // Comparativo Atendidas vs Não Atendidas (por agente agregado)
    const comparativoAtendimentos = useMemo(() => {
        return (ramalData || []).map((r) => ({ name: r.ramal || '—', atendidas: Number(r.totalAtendidas || r.entradaAtendidas || 0), naoAtendidas: Number(r.totalNaoAtendidas || r.entradaNaoAtendidas || 0) }));
    }, [ramalData]);

    // util parse de data flexível
    function parseDateFlexible(input) {
        if (!input) return null;
        // tenta formatos comuns
        let d = null;
        // se já é Date
        if (input instanceof Date) return input;
        // normalize
        const s = input.toString().trim();
        // try ISO
        const iso = new Date(s);
        if (!isNaN(iso.getTime())) return iso;
        // try DD/MM/YYYY
        const parts = s.match(/^(\d{1,2})\D(\d{1,2})\D(\d{2,4})$/);
        if (parts) {
            const day = Number(parts[1]);
            const month = Number(parts[2]) - 1;
            let year = Number(parts[3]);
            if (year < 100) year += 2000;
            d = new Date(year, month, day);
            if (!isNaN(d.getTime())) return d;
        }
        return null;
    }

    // filtragem por agente (aplicada na UI)
    const filteredComparison = useMemo(() => {
        if (!agentFilter) return agentsComparison;
        const k = keyify(agentFilter);
        return (agentsComparison || []).filter((r) => keyify(r.ramal).includes(k));
    }, [agentsComparison, agentFilter]);

    // paleta para pie
    const COLORS = ['#1E3A8A', '#2563EB', '#60A5FA', '#93C5FD', '#BFDBFE', '#1E40AF', '#1D4ED8'];

    return (
       <div className="min-h-screen bg-white text-slate-800 p-4 md:p-8">
            <header className="mb-6">
                <h1 className="text-2xl md:text-3xl font-semibold">Dashboard de Análise de Atendimento</h1>
                <p className="text-sm text-slate-500">Upload de 3 CSVs → análises, cruzamentos e gráficos. Paleta: tons de azul e branco.</p>
            </header>

            <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 border rounded-lg shadow-sm">
                    <label className="block text-sm font-medium">1) Estatísticas de Ramal (CSV)</label>
                    <input type="file" accept="text/csv,.csv" onChange={handleUpload1} className="mt-2" />
                    <div className="text-xs mt-2 text-slate-500">Colunas esperadas: Ramal do Agente, Entrada Atendidas, Entrada Não Atendidas, Saída Atendidas, Saída Não Atendidas, Total Atendidas, Total Não Atendidas, Total de Conversas.</div>
                </div>


                <div className="p-4 border rounded-lg shadow-sm">
                    <label className="block text-sm font-medium">2) Top 10 Requerentes (CSV)</label>
                    <input type="file" accept="text/csv,.csv" onChange={handleUpload2} className="mt-2" />
                    <div className="text-xs mt-2 text-slate-500">Colunas esperadas: Nome, Quantidade.</div>
                </div>


                <div className="p-4 border rounded-lg shadow-sm">
                    <label className="block text-sm font-medium">3) Chamados ServiceAide (CSV)</label>
                    <input type="file" accept="text/csv,.csv" onChange={handleUpload3} className="mt-2" />
                    <div className="text-xs mt-2 text-slate-500">Colunas esperadas: Nome, Categoria, Data de Criação, Data Último Encerramento.</div>
                </div>
            </section>

            <section className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                    <label className="block text-xs font-medium text-slate-600">Filtro: Agente</label>
                    <input placeholder="Digite o ramal ou nome do agente" value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} className="mt-2 w-full border rounded p-2 text-sm" />
                </div>


                <div className="p-4 border rounded-lg">
                    <label className="block text-xs font-medium text-slate-600">Data From</label>
                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-2 w-full border rounded p-2 text-sm" />
                </div>


                <div className="p-4 border rounded-lg">
                    <label className="block text-xs font-medium text-slate-600">Data To</label>
                    <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-2 w-full border rounded p-2 text-sm" />
                </div>
            </section>

            {/* Painel de conferência */}
            <section className="mb-6">
                <h2 className="text-lg font-medium mb-3">Métrica de Consistência por Agente</h2>
                <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-3 py-2 text-left">Ramal</th>
                                <th className="px-3 py-2 text-right">Entrada Atendidas</th>
                                <th className="px-3 py-2 text-right">Quantidade Requerentes</th>
                                <th className="px-3 py-2 text-right">Chamados ServiceAide</th>
                                <th className="px-3 py-2 text-right">Total Conversas</th>
                                <th className="px-3 py-2 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredComparison && filteredComparison.length ? (
                                filteredComparison.map((r, idx) => (
                                <tr key={idx} className="odd:bg-white even:bg-slate-50">
                                    <td className="px-3 py-2">{r.ramal}</td>
                                    <td className="px-3 py-2 text-right">{r.entradaAtendidas}</td>
                                    <td className="px-3 py-2 text-right">{r.quantidadeRequerentes}</td>
                                    <td className="px-3 py-2 text-right">{r.chamadosServiceAide}</td>
                                    <td className="px-3 py-2 text-right">{r.totalConversas}</td>
                                    <td className="px-3 py-2 text-center">
                                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${r.status === 'OK' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{r.status}</span>
                                    </td>
                                </tr>
                        ))
                        ) : (
                        <tr>
                        <td className="p-4" colSpan={6}>Nenhum dado carregado ou nenhum agente corresponde ao filtro.</td>
                        </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Gráficos */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="p-4 border rounded-lg h-80">
                    <h3 className="text-md font-medium mb-3">Top 10 agentes por Total de Conversas</h3>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={top10ByConversas} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" />
                                <YAxis dataKey="name" type="category" width={150} />
                                <Tooltip />
                                <Bar dataKey="value" name="Total de Conversas" fill="#2563EB" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>


                    <div className="p-4 border rounded-lg h-80">
                        <h3 className="text-md font-medium mb-3">Distribuição de Chamados por Categoria</h3>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Tooltip />
                                    <Legend />
                                    <Pie data={chamadosPorCategoria} dataKey="count" nameKey="categoria" outerRadius={80} label>
                                    {chamadosPorCategoria.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                    </div>


                    <div className="p-4 border rounded-lg h-80">
                        <h3 className="text-md font-medium mb-3">Evolução do volume de chamados por Data de Criação</h3>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={evolucaoPorData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#60A5FA'" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#60A5FA'" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="date" />
                                <YAxis />
                                <CartesianGrid strokeDasharray="3 3" />
                                <Tooltip />
                                <Area type="monotone" dataKey="count" stroke="#1D4ED8" fillOpacity={0.2} fill="#93C5FD" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>


                <div className="p-4 border rounded-lg h-80">
                    <h3 className="text-md font-medium mb-3">Comparativo: Chamados Atendidos vs Não Atendidos</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={comparativoAtendimentos} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="atendidas" name="Atendidas" stackId="a" fill="#1E40AF" />
                            <Bar dataKey="naoAtendidas" name="Não Atendidas" stackId="a" fill="#93C5FD" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </section>

            <footer className="text-xs text-slate-500">Dica: use nomes/ramais consistentes nos 3 arquivos para obter resultados corretos. Ajustes de normalização já são aplicados (trim + lower case).</footer>
        </div>
    );
}