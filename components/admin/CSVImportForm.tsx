'use client'

import { useState, useTransition, useRef } from 'react'
import Papa from 'papaparse'
import { Button } from '@/components/ui/button'
import { importUsersFromCSVAction, type ImportResult } from '@/lib/actions/admin.actions'
import { cn } from '@/lib/utils'
import { Upload, CheckCircle, AlertCircle, Users, FileText } from 'lucide-react'

type ParsedRow = { full_name: string; email: string; role: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const VALID_ROLES = ['learner', 'instructor', 'admin']

function validateRow(row: ParsedRow) {
  if (!row.email || !EMAIL_RE.test(row.email)) return 'Email inválido'
  if (!VALID_ROLES.includes(row.role)) return `Rol "${row.role}" no válido`
  return null
}

const ROLE_STYLES: Record<string, string> = {
  admin: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
  instructor: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
  learner: 'bg-slate-500/15 text-slate-400 border-slate-500/25',
}

export function CSVImportForm() {
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string>('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  function parseFile(file: File) {
    setParseError(null)
    setFileName(file.name)
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
      complete: (results) => {
        if (!results.data.length) {
          setParseError('El CSV está vacío o no tiene filas de datos.')
          return
        }
        const normalized: ParsedRow[] = results.data.map((row) => ({
          full_name: String(row['full_name'] ?? row['name'] ?? '').trim(),
          email: String(row['email'] ?? '').trim().toLowerCase(),
          role: String(row['role'] ?? 'learner').trim().toLowerCase(),
        }))
        setRows(normalized)
        setStep('preview')
      },
      error: (err) => setParseError(`Error al parsear el CSV: ${err.message}`),
    })
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) parseFile(file)
  }

  function handleImport() {
    const validRows = rows.filter((r) => !validateRow(r))
    startTransition(async () => {
      const fd = new FormData()
      fd.set('rows', JSON.stringify(validRows))
      const res = await importUsersFromCSVAction(null, fd)
      setResult(res)
      setStep('done')
    })
  }

  function reset() {
    setRows([])
    setResult(null)
    setParseError(null)
    setFileName('')
    setStep('upload')
    if (inputRef.current) inputRef.current.value = ''
  }

  /* ── Upload ── */
  if (step === 'upload') {
    return (
      <div className="space-y-4">
        {parseError && (
          <div role="alert" className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">
            {parseError}
          </div>
        )}

        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-card/40 px-8 py-14 cursor-pointer transition-colors hover:border-primary/50 hover:bg-card/70"
        >
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
            <Upload size={22} />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">Arrastrá o hacé click para subir un CSV</p>
            <p className="text-xs text-muted-foreground mt-1">Columnas: <code className="font-mono">full_name, email, role</code></p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f) }}
          />
        </div>

        <div className="rounded-lg border border-border bg-card/40 p-4 space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Ejemplo de CSV</p>
          <pre className="text-xs font-mono text-muted-foreground leading-relaxed">
{`full_name,email,role
Jane Doe,jane@company.com,learner
John Smith,john@company.com,instructor
Maria García,maria@company.com,admin`}
          </pre>
        </div>
      </div>
    )
  }

  /* ── Preview ── */
  if (step === 'preview') {
    const validCount = rows.filter((r) => !validateRow(r)).length
    const errorCount = rows.length - validCount

    return (
      <div className="space-y-5">
        {/* Summary chips */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm">
            <FileText size={13} className="text-muted-foreground" />
            <span className="text-muted-foreground">{fileName}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-sm">
            <CheckCircle size={13} className="text-emerald-400" />
            <span className="font-medium text-emerald-400">{validCount}</span>
            <span className="text-muted-foreground">válidos</span>
          </div>
          {errorCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-sm">
              <AlertCircle size={13} className="text-red-400" />
              <span className="font-medium text-red-400">{errorCount}</span>
              <span className="text-muted-foreground">con error</span>
            </div>
          )}
        </div>

        {/* Preview table */}
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/20">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">#</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Nombre</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Email</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Rol</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 15).map((row, i) => {
                const err = validateRow(row)
                return (
                  <tr key={i} className={cn('border-b border-border/40 last:border-0', err && 'bg-red-500/5')}>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2">{row.full_name || <span className="text-muted-foreground">—</span>}</td>
                    <td className={cn('px-3 py-2 font-mono text-xs', !EMAIL_RE.test(row.email) && 'text-red-400')}>
                      {row.email || <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium', ROLE_STYLES[row.role] ?? 'bg-red-500/15 text-red-400 border-red-500/25')}>
                        {row.role || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {err
                        ? <span className="text-[11px] text-red-400">{err}</span>
                        : <span className="text-[11px] text-emerald-400">✓</span>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {rows.length > 15 && (
            <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border bg-muted/10">
              Mostrando 15 de {rows.length} filas — se importarán {validCount} válidas
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            type="button"
            onClick={handleImport}
            disabled={isPending || validCount === 0}
          >
            {isPending ? 'Importando…' : `Importar ${validCount} usuario${validCount !== 1 ? 's' : ''}`}
          </Button>
          <Button type="button" variant="outline" onClick={reset} disabled={isPending}>
            Cancelar
          </Button>
        </div>
      </div>
    )
  }

  /* ── Done ── */
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-5 py-4">
          <CheckCircle size={22} className="text-emerald-400" />
          <div>
            <div className="text-2xl font-bold text-emerald-400">{result?.created}</div>
            <div className="text-xs text-muted-foreground">creados</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-4">
          <Users size={22} className="text-muted-foreground" />
          <div>
            <div className="text-2xl font-bold">{result?.skipped}</div>
            <div className="text-xs text-muted-foreground">ya existían</div>
          </div>
        </div>
        {(result?.errors.length ?? 0) > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-red-500/25 bg-red-500/10 px-5 py-4">
            <AlertCircle size={22} className="text-red-400" />
            <div>
              <div className="text-2xl font-bold text-red-400">{result!.errors.length}</div>
              <div className="text-xs text-muted-foreground">errores</div>
            </div>
          </div>
        )}
      </div>

      {result?.created !== undefined && result.created > 0 && (
        <div className="rounded-md bg-emerald-500/10 border border-emerald-500/25 px-4 py-3 text-sm text-emerald-400">
          Los usuarios creados pueden iniciar sesión usando <strong>Olvidé mi contraseña</strong> para establecer su contraseña.
        </div>
      )}

      {(result?.errors.length ?? 0) > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border bg-muted/20">
            Filas con error
          </div>
          {result!.errors.filter(e => e.row > 0).map((e, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 text-sm border-b border-border/40 last:border-0">
              <span className="shrink-0 text-[11px] text-muted-foreground">Fila {e.row}</span>
              <span className="font-mono text-xs truncate">{e.email || '—'}</span>
              <span className="ml-auto shrink-0 text-[11px] text-red-400">{e.reason}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={reset}>
          Importar otro CSV
        </Button>
        <Button type="button" onClick={() => window.location.href = '/admin/users'}>
          Ver usuarios
        </Button>
      </div>
    </div>
  )
}
