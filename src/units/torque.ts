/** Torque is stored internally in newton-metres (SI). */
export type Torque = number & { readonly __unit: "Torque_Nm" };

export function newtonMetres(value: number): Torque {
  return value as Torque;
}

export function toNewtonMetres(value: Torque): number {
  return value;
}

/** N·mm, a common display unit for mainspring torque (1 N·mm = 1e-3 N·m). */
export function newtonMillimetres(value: number): Torque {
  return (value * 1e-3) as Torque;
}

export function toNewtonMillimetres(value: Torque): number {
  return value / 1e-3;
}
