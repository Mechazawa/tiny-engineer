import { useState } from "preact/hooks";
import { apiFetch } from "../api/client";
import { useResettableState } from "../useResettableState";

const RGB_ORDERS = ["RGB", "RBG", "GRB", "GBR", "BRG", "BGR"];

export const releaseLed = () => apiFetch("/setup/led", { method: "POST" }).catch(() => {});

// `looks` holds the color seen for each WS2812 wire byte; together they spell the RGB order.
export function useLedMapping(savedOrder: string) {
  const [looks, setLooks] = useResettableState(savedOrder, (order) => [...order]);
  const [remapOpen, setRemapOpen] = useState(false);
  const order = looks.join("");

  return {
    savedOrder,
    looks,
    setLooks,
    order,
    valid: RGB_ORDERS.includes(order),
    remapOpen,
    setRemapOpen,
  };
}

export type LedMapping = ReturnType<typeof useLedMapping>;
