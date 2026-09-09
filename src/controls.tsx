import React from 'react';
import type { AudioDevice } from './shared';
import { Icon } from './icons';
export function Level({ value, className }: { value: number; className?: string }) {
  return <div className={'bar ' + (className ?? '')} role="meter" aria-valuemin={0} aria-valuemax={1} aria-valuenow={value}>
    <i style={{ '--v': Math.round(Math.min(1, Math.max(0, value)) * 100) + '%' } as React.CSSProperties} /></div>;
}
export function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange(next: boolean): void; disabled?: boolean; label?: string }) {
  return <label className="switch"><input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} aria-label={label} /><span /></label>;
}
export function DeviceSelect({ id, value, onChange, disabled, devices, placeholder }:
  { id: string; value: string; onChange(id: string): void; disabled?: boolean; devices: AudioDevice[]; placeholder: string }) {
  return <div className="select"><select id={id} disabled={disabled} value={value} onChange={e => onChange(e.target.value)}>
    <option value="">{placeholder}</option>{devices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}</select><Icon name="chevron" size={16} /></div>;
}

