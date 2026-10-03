import Image from 'next/image';
import assets from '@/../public/brand/mascot/manifest.json';

/** Pip is a brand character. Static inside the Arena, never present in exam questions. */
export function Mascot({ pose = 'greeting', facing = 'right', className = '', alt = '', eager = false }) {
  const asset = assets[pose] || assets.greeting;
  return <Image className={`pip-image ${className}`} data-pose={pose} data-facing={facing} src={asset.src} width={asset.width} height={asset.height} sizes="(max-width: 600px) 110px, 160px" loading={eager ? 'eager' : 'lazy'} alt={alt} />;
}

/** A reserved perch. With `station`, PipGuide can land here (the static pose stays the fallback). */
export function MascotSeat({ pose, facing = 'left', label, note, className = '', eager = false, station }) {
  return <figure className={`pip-seat ${className}`} data-pip-station={station} data-pip-pose={station ? pose : undefined}><div className="pip-seat__art"><Mascot pose={pose} facing={pose === 'pointing' ? facing : 'right'} eager={eager} alt={`Mobi, MockMob’s study companion, ${pose === 'attentive' ? 'listening attentively' : pose === 'thinking' ? 'thinking' : pose === 'pointing' ? 'pointing towards your next step' : pose === 'celebrating' ? 'celebrating a finished drill' : pose === 'encouraging' ? 'cheering you on' : pose === 'idle' ? 'sitting beside the preview' : 'waving hello'}.`} /></div><figcaption><b>{label}</b>{note && <span>{note}</span>}</figcaption></figure>;
}
