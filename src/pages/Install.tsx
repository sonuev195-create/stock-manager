import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Smartphone, Check } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function Install() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Install App</h1>

      <Card className="bg-card">
        <CardHeader className="p-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            Install on Your Device
          </CardTitle>
          <CardDescription>
            Install this app on your device for quick access and offline support.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {isInstalled ? (
            <div className="flex items-center gap-2 text-green-400">
              <Check className="w-5 h-5" />
              <span>App is already installed!</span>
            </div>
          ) : deferredPrompt ? (
            <Button onClick={handleInstall} className="gap-2">
              <Download className="w-4 h-4" />
              Install Now
            </Button>
          ) : (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p><strong>iOS (Safari):</strong> Tap Share → Add to Home Screen</p>
              <p><strong>Android (Chrome):</strong> Tap Menu → Install App</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
