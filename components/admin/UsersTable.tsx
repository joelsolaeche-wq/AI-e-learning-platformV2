'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useTransition, useState, useEffect, useRef } from 'react'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { updateUserRoleAction, toggleUserStatusAction } from '@/lib/actions/admin.actions'

type UserRow = {
  id: string
  email: string
  full_name: string | null
  role: string
  is_active: boolean
  avatar_url: string | null
  created_at: string
}

const ROLE_STYLES: Record<string, string> = {
  admin: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
  instructor: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
  learner: 'bg-slate-500/15 text-slate-400 border-slate-500/25',
}

const PRESET_AVATARS: Record<string, { bg: string; symbol: string }> = {
  'violet-hex':   { bg: 'from-violet-500 to-purple-600', symbol: '✦' },
  'cyan-wave':    { bg: 'from-cyan-400 to-blue-500',     symbol: '◈' },
  'rose-spark':   { bg: 'from-rose-400 to-pink-500',     symbol: '❋' },
  'amber-sun':    { bg: 'from-amber-400 to-orange-500',  symbol: '◉' },
  'emerald-leaf': { bg: 'from-emerald-400 to-teal-500',  symbol: '◆' },
  'indigo-star':  { bg: 'from-indigo-400 to-violet-500', symbol: '★' },
}

interface UsersTableProps {
  users: UserRow[]
  q: string
  roleFilter: string
  activeFilter: string
  page: number
  totalPages: number
}

export function UsersTable({ users, q, roleFilter, activeFilter, page, totalPages }: UsersTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [searchValue, setSearchValue] = useState(q)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setSearchValue(q) }, [q])

  function buildUrl(overrides: Record<string, string>) {
    const params = new URLSearchParams()
    const values: Record<string, string> = {
      ...(q ? { q } : {}),
      ...(roleFilter ? { role: roleFilter } : {}),
      ...(activeFilter ? { active: activeFilter } : {}),
      ...(page > 1 ? { page: String(page) } : {}),
      ...overrides,
    }
    Object.entries(values).forEach(([k, v]) => { if (v) params.set(k, v) })
    const qs = params.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  function handleSearchInput(value: string) {
    setSearchValue(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      router.push(buildUrl({ q: value, page: '1' }))
    }, 400)
  }

  function handleRoleFilter(value: string) {
    router.push(buildUrl({ role: value, page: '1' }))
  }

  function handleActiveFilter(value: string) {
    router.push(buildUrl({ active: value, page: '1' }))
  }

  function handleToggleStatus(userId: string, currentActive: boolean) {
    startTransition(async () => {
      await toggleUserStatusAction(userId, !currentActive)
      router.refresh()
    })
  }

  function handleRoleChange(userId: string, role: 'learner' | 'instructor' | 'admin') {
    startTransition(async () => {
      await updateUserRoleAction(userId, role)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={searchValue}
          onChange={(e) => handleSearchInput(e.target.value)}
          placeholder="Buscar por nombre o email…"
          className="h-8 w-60 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        <select
          value={roleFilter}
          onChange={(e) => handleRoleFilter(e.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none"
        >
          <option value="">Todos los roles</option>
          <option value="learner">Learner</option>
          <option value="instructor">Instructor</option>
          <option value="admin">Admin</option>
        </select>
        <select
          value={activeFilter}
          onChange={(e) => handleActiveFilter(e.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none"
        >
          <option value="">Todos los estados</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
      </div>

      {/* Table */}
      <div className={cn('rounded-xl border border-border bg-card', isPending && 'opacity-60 pointer-events-none')}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Registrado</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  No se encontraron usuarios.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => {
                const preset = user.avatar_url ? PRESET_AVATARS[user.avatar_url] : null
                const isUrl = user.avatar_url && !preset
                const initials = (user.full_name || user.email).slice(0, 2).toUpperCase()
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        {isUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={user.avatar_url!} alt={initials} className="h-7 w-7 rounded-full object-cover flex-shrink-0" />
                        ) : preset ? (
                          <div className={cn('grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-gradient-to-br text-xs text-white', preset.bg)}>
                            {preset.symbol}
                          </div>
                        ) : (
                          <div className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-[11px] font-semibold text-primary-foreground">
                            {initials}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium truncate">{user.full_name || '—'}</div>
                          <div className="text-[11px] text-muted-foreground truncate">{user.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium', ROLE_STYLES[user.role] ?? ROLE_STYLES.learner)}>
                        {user.role}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium', user.is_active ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' : 'bg-red-500/15 text-red-400 border-red-500/25')}>
                        {user.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground"
                          aria-label="Acciones"
                        >
                          <MoreHorizontal size={14} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="bottom" align="end" className="w-48">
                          <DropdownMenuItem
                            className="cursor-pointer text-sm"
                            onClick={() => router.push(`/admin/users/${user.id}`)}
                          >
                            Editar usuario
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="cursor-pointer text-sm" onClick={() => handleRoleChange(user.id, 'learner')}>
                            Rol: Learner
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer text-sm" onClick={() => handleRoleChange(user.id, 'instructor')}>
                            Rol: Instructor
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer text-sm" onClick={() => handleRoleChange(user.id, 'admin')}>
                            Rol: Admin
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="cursor-pointer text-sm"
                            variant={user.is_active ? 'destructive' : undefined}
                            onClick={() => handleToggleStatus(user.id, user.is_active)}
                          >
                            {user.is_active ? 'Desactivar cuenta' : 'Activar cuenta'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <a
            href={page > 1 ? buildUrl({ page: String(page - 1) }) : '#'}
            aria-disabled={page <= 1}
            className={cn('grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground', page <= 1 ? 'pointer-events-none opacity-40' : 'hover:bg-white/5 hover:text-foreground')}
          >
            <ChevronLeft size={14} />
          </a>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <a
            href={page < totalPages ? buildUrl({ page: String(page + 1) }) : '#'}
            aria-disabled={page >= totalPages}
            className={cn('grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground', page >= totalPages ? 'pointer-events-none opacity-40' : 'hover:bg-white/5 hover:text-foreground')}
          >
            <ChevronRight size={14} />
          </a>
        </div>
      )}
    </div>
  )
}
