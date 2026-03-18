'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Globe,
  Shield,
  Scan,
  Lock,
  Settings,
  FileText,
  LogOut,
  ChevronRight,
  Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PNBLogo } from '@/components/icons/pnb-logo'
import { useAuth } from '@/contexts/auth-context'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const navigationItems = [
  {
    title: 'Overview',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Scanner', href: '/scanner', icon: Scan },
    ],
  },
  {
    title: 'Assets',
    items: [
      { name: 'Domains', href: '/assets/domains', icon: Globe },
      { name: 'SSL Certificates', href: '/assets/ssl', icon: Shield },
      { name: 'IP Addresses', href: '/assets/ips', icon: Activity },
      { name: 'Software', href: '/assets/software', icon: FileText },
    ],
  },
  {
    title: 'Security',
    items: [
      { name: 'Crypto Inventory', href: '/crypto', icon: Lock },
      { name: 'Reports', href: '/reports', icon: FileText },
    ],
  },
  {
    title: 'System',
    items: [
      { name: 'Settings', href: '/settings', icon: Settings },
    ],
  },
]

interface EngineStatusProps {
  isOnline: boolean
}

function EngineStatus({ isOnline }: EngineStatusProps) {
  const { state } = useSidebar()
  const isCollapsed = state === 'collapsed'

  return (
    <div className={cn(
      'flex items-center gap-2 px-2 py-2 rounded-lg glass-maroon',
      isCollapsed && 'justify-center'
    )}>
      <motion.div
        className={cn(
          'w-2.5 h-2.5 rounded-full shrink-0',
          isOnline ? 'bg-emerald-500' : 'bg-red-500'
        )}
        animate={isOnline ? {
          boxShadow: [
            '0 0 0 0 rgba(16, 185, 129, 0.7)',
            '0 0 0 6px rgba(16, 185, 129, 0)',
          ],
        } : {}}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      {!isCollapsed && (
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-medium text-foreground truncate">
            Scanner Engine
          </span>
          <span className={cn(
            'text-[10px] uppercase tracking-wider',
            isOnline ? 'text-emerald-400' : 'text-red-400'
          )}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      )}
    </div>
  )
}

export function AppSidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { state } = useSidebar()
  const isCollapsed = state === 'collapsed'

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      {/* Header with Logo */}
      <SidebarHeader className="border-b border-sidebar-border pb-4">
        <Link href="/dashboard" className="block">
          <PNBLogo showText={!isCollapsed} />
        </Link>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent className="px-2">
        <AnimatePresence>
          {navigationItems.map((group, groupIndex) => (
            <SidebarGroup key={group.title}>
              <SidebarGroupLabel className="text-muted-foreground/60 uppercase text-[10px] tracking-widest">
                {group.title}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item, itemIndex) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                    const Icon = item.icon

                    return (
                      <motion.div
                        key={item.name}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          delay: groupIndex * 0.1 + itemIndex * 0.05,
                          duration: 0.3,
                        }}
                      >
                        <SidebarMenuItem>
                          <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            tooltip={item.name}
                            className={cn(
                              'relative transition-all duration-200',
                              isActive && 'bg-pnb-maroon/20 text-pnb-gold border-l-2 border-pnb-gold'
                            )}
                          >
                            <Link href={item.href}>
                              <Icon className={cn(
                                'h-4 w-4 transition-colors',
                                isActive ? 'text-pnb-gold' : 'text-muted-foreground'
                              )} />
                              <span className={cn(
                                isActive && 'text-pnb-gold font-medium'
                              )}>
                                {item.name}
                              </span>
                              {isActive && !isCollapsed && (
                                <ChevronRight className="ml-auto h-4 w-4 text-pnb-gold" />
                              )}
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      </motion.div>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </AnimatePresence>
      </SidebarContent>

      <SidebarSeparator />

      {/* Footer */}
      <SidebarFooter className="p-2 space-y-3">
        {/* Engine Status */}
        <EngineStatus isOnline={true} />

        {/* User Info & Logout */}
        {user && (
          <div className={cn(
            'flex items-center gap-2 p-2 rounded-lg bg-secondary/50',
            isCollapsed && 'justify-center'
          )}>
            <div className="w-8 h-8 rounded-full bg-pnb-maroon flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-primary-foreground uppercase">
                {user.username.charAt(0)}
              </span>
            </div>
            {!isCollapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.username}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">{user.role}</p>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 hover:bg-destructive/20 hover:text-destructive"
                      onClick={handleLogout}
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Logout</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
