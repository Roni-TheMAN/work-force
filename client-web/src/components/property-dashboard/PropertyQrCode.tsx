import { useEffect, useState } from "react";
import QRCode from "qrcode";

type PropertyQrCodeProps = {
  alt: string;
  className?: string;
  size?: number;
  value: string;
};

export function PropertyQrCode({ alt, className, size = 240, value }: PropertyQrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void QRCode.toDataURL(value, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: size,
    }).then((nextValue: string) => {
      if (!cancelled) {
        setDataUrl(nextValue);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [size, value]);

  if (!dataUrl) {
    return (
      <div className="flex h-full min-h-56 items-center justify-center text-sm text-muted-foreground">
        Generating QR…
      </div>
    );
  }

  return <img src={dataUrl} alt={alt} className={className} />;
}
