"use client";

import { useCallback, useState, useRef, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const rmQuery = "(prefers-reduced-motion: reduce)";
function rmSubscribe(cb) {
  const mq = window.matchMedia(rmQuery);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function rmSnapshot() {
  return window.matchMedia(rmQuery).matches;
}
function useReducedMotion() {
  return useSyncExternalStore(rmSubscribe, rmSnapshot, () => false);
}

export function ScrollReveal({
  children,
  className,
  delay = 0,
  direction = "up",
  distance = 24,
  duration = 600,
  initialInView = false,
  once = true,
  threshold = 0.15,
  as: Tag = "div",
  ...props
}) {
  const [inView, setInView] = useState(initialInView);
  const observerRef = useRef(null);
  const prefersReduced = useReducedMotion();
  const visible = inView || prefersReduced;

  const callbackRef = useCallback(
    (el) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (!el || prefersReduced) return;

      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        setInView(true);
        if (once) return;
      }

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setInView(true);
            if (once) observer.unobserve(el);
          }
        },
        { threshold, rootMargin: "0px 0px -40px 0px" }
      );
      observer.observe(el);
      observerRef.current = observer;
    },
    [once, threshold, prefersReduced]
  );

  const translate =
    direction === "up"
      ? `translateY(${distance}px)`
      : direction === "down"
      ? `translateY(-${distance}px)`
      : direction === "left"
      ? `translateX(${distance}px)`
      : `translateX(-${distance}px)`;

  return (
    <Tag
      ref={callbackRef}
      className={cn(className)}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translate3d(0,0,0)" : translate,
        transition: prefersReduced
          ? "none"
          : `opacity ${duration}ms cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform ${duration}ms cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
        willChange: visible ? "auto" : "opacity, transform",
        ...props.style,
      }}
      {...props}
    >
      {children}
    </Tag>
  );
}

export function StaggerGroup({
  children,
  className,
  stagger = 80,
  ...revealProps
}) {
  return (
    <div className={className}>
      {Array.isArray(children)
        ? children.map((child, i) => (
            <ScrollReveal key={i} delay={i * stagger} {...revealProps}>
              {child}
            </ScrollReveal>
          ))
        : children}
    </div>
  );
}
