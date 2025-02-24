import React from "react";

export const Alert = React.forwardRef(({ className = "", variant = "default", ...props }, ref) => {
  const getColorClasses = () => {
    switch (variant) {
      case "destructive":
        return "border-red-900/20 text-red-200";
      case "success":
        return "text-gray-200";
      default:
        return "text-gray-200"; 
    }
  };

  return (
    <div
      ref={ref}
      role="alert"
      className={`rounded-lg border p-4 bg-black/20 ${getColorClasses()} ${className}`}
      style={{ 
        borderColor: variant === "destructive" ? "rgba(127, 29, 29, 0.2)" : "rgb(var(--primary) / 0.2)"
      }}
      {...props}
    />
  );
});

export const AlertDescription = React.forwardRef(({ className = "", ...props }, ref) => (
  <div
    ref={ref}
    className={`text-sm leading-relaxed ${className}`}
    {...props}
  />
));

Alert.displayName = "Alert";
AlertDescription.displayName = "AlertDescription";