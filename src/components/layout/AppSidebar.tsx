import { Home, ShoppingCart, FileText, Package, Boxes, Truck, Settings, Download, LogOut, Receipt, BookOpen, BarChart3, Upload } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

const mainItems = [
  { title: 'Dashboard', url: '/', icon: Home },
  { title: 'Sales', url: '/sales', icon: ShoppingCart },
  { title: 'Bills', url: '/bills', icon: Receipt },
  { title: 'Today', url: '/ledger', icon: BookOpen },
  { title: 'Reports', url: '/reports', icon: BarChart3 },
  { title: 'Bill Upload', url: '/bulk-upload', icon: Upload },
];

const inventoryItems = [
  { title: 'Items', url: '/items', icon: Package },
  { title: 'Inventory', url: '/inventory', icon: Boxes },
  { title: 'Purchases', url: '/purchases', icon: FileText },
  { title: 'Suppliers', url: '/suppliers', icon: Truck },
];

const settingsItems = [
  { title: 'Settings', url: '/settings', icon: Settings },
  { title: 'Install App', url: '/install', icon: Download },
];

function NavLinkWithCollapse({ item, isMobile, setOpenMobile }: { 
  item: { title: string; url: string; icon: React.ElementType }; 
  isMobile: boolean;
  setOpenMobile: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(item.url);
    // Auto-collapse on mobile
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <a 
      href={item.url}
      onClick={handleClick}
      className="flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-sidebar-accent"
    >
      <item.icon className="w-4 h-4" />
      <span>{item.title}</span>
    </a>
  );
}

export function AppSidebar() {
  const { signOut } = useAuth();
  const isMobile = useIsMobile();
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="p-3 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
            <Boxes className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm">Inventory Manager</span>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs text-muted-foreground px-2">Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild size="sm">
                    <NavLinkWithCollapse item={item} isMobile={isMobile} setOpenMobile={setOpenMobile} />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs text-muted-foreground px-2">Inventory</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {inventoryItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild size="sm">
                    <NavLinkWithCollapse item={item} isMobile={isMobile} setOpenMobile={setOpenMobile} />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs text-muted-foreground px-2">System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild size="sm">
                    <NavLinkWithCollapse item={item} isMobile={isMobile} setOpenMobile={setOpenMobile} />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2 border-t border-sidebar-border">
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground" onClick={signOut}>
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
