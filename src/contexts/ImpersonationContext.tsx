import { createContext, useContext, useState, ReactNode } from "react";

type ImpersonationContextType = {
  impersonating: { id: string; name: string; role: string; department: string } | null;
  startImpersonation: (user: { id: string; name: string; role: string; department: string }) => void;
  stopImpersonation: () => void;
};

const ImpersonationContext = createContext<ImpersonationContextType>({
  impersonating: null,
  startImpersonation: () => {},
  stopImpersonation: () => {},
});

export const useImpersonation = () => useContext(ImpersonationContext);

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [impersonating, setImpersonating] = useState<ImpersonationContextType["impersonating"]>(null);

  const startImpersonation = (user: { id: string; name: string; role: string; department: string }) => {
    setImpersonating(user);
  };

  const stopImpersonation = () => {
    setImpersonating(null);
  };

  return (
    <ImpersonationContext.Provider value={{ impersonating, startImpersonation, stopImpersonation }}>
      {children}
    </ImpersonationContext.Provider>
  );
}
