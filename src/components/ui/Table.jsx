import { useState } from 'react';
import { Search, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';

export const Table = ({
  columns,
  data = [],
  searchable = true,
  searchPlaceholder = 'Search records...',
  onRowClick,
  emptyMessage = 'No records found.',
  cardRender,
  actions
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter data
  const filteredData = data.filter((item) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return Object.values(item).some(val => 
      val !== null && val !== undefined && typeof val !== 'object' && String(val).toLowerCase().includes(term)
    );
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-4">
      {(searchable || actions) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {searchable ? (
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" strokeWidth={1.8} />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full pl-10 pr-4 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all text-slate-800 dark:text-slate-100 placeholder-slate-400 shadow-2xs font-medium"
              />
            </div>
          ) : <div />}
          {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
        </div>
      )}

      {/* Desktop / Tablet Table View */}
      <div className={`hidden ${cardRender ? 'md:block' : 'block'} bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 dark:bg-slate-900/90 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {columns.map((col, idx) => (
                  <th key={idx} className={`py-3.5 px-4 ${col.className || ''}`}>
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm text-slate-700 dark:text-slate-300">
              {paginatedData.length > 0 ? (
                paginatedData.map((row, rowIdx) => (
                  <tr
                    key={row.id || row.code || rowIdx}
                    onClick={() => onRowClick && onRowClick(row)}
                    className={`transition-colors duration-150 ${onRowClick ? 'cursor-pointer hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20' : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'}`}
                  >
                    {columns.map((col, colIdx) => (
                      <td key={colIdx} className={`py-3.5 px-4 whitespace-nowrap ${col.className || ''}`}>
                        {col.render ? col.render(row) : row[col.accessor] !== undefined ? row[col.accessor] : '—'}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2.5">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
                        <Inbox className="w-6 h-6" strokeWidth={1.75} />
                      </div>
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{emptyMessage}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View (Fallback for small screens when cardRender is provided) */}
      {cardRender && (
        <div className="md:hidden space-y-3">
          {paginatedData.length > 0 ? (
            paginatedData.map((row, rowIdx) => (
              <div 
                key={row.id || row.code || rowIdx}
                onClick={() => onRowClick && onRowClick(row)}
                className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm ${onRowClick ? 'cursor-pointer active:scale-[0.99] transition-transform' : ''}`}
              >
                {cardRender(row)}
              </div>
            ))
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center text-slate-400 flex flex-col items-center gap-2">
              <Inbox className="w-8 h-8 text-slate-300 dark:text-slate-600" strokeWidth={1.75} />
              <p className="text-sm font-medium">{emptyMessage}</p>
            </div>
          )}
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 pt-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
          <span>Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} entries</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" strokeWidth={1.8} />
            </button>
            <span className="font-bold px-2 text-slate-700 dark:text-slate-300">Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronRight className="w-4 h-4" strokeWidth={1.8} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
