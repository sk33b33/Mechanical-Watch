/** Torque is stored internally in newton-metres (SI). */
export type Torque = number & { readonly __unit: "Torque_Nm" };

export function newtonMetres(value: number): Torque {
  return value as Torque;
}

export function toNewtonMetres(value: Torque): number {
  return value;
}
