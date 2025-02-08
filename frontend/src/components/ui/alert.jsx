import React from "react";

export const Alert = React.forwardRef(({ className = "", variant = "default", ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={`rounded-lg border p-4 ${
      variant === "destructive" ? "bg-red-900 text-red-100 border-red-800" : "bg-gray-700 text-gray-200 border-gray-600"
    } ${className}`}
    {...props}
  />
));

export const AlertDescription = React.forwardRef(({ className = "", ...props }, ref) => (
  <div
    ref={ref}
    className={`text-sm leading-relaxed ${className}`}
    {...props}
  />
));

Alert.displayName = "Alert";
AlertDescription.displayName = "AlertDescription";