// Botón "Ver link de conexión" de una conexión de WhatsApp pendiente + su diálogo. Se usa en la vista de conexiones y en la ficha de la company.
// Solo se ofrece si la conexión está pendiente y el link no venció; el link se pide al servidor recién al abrir el diálogo (queda auditado).
import { useState } from "react";
import { createPortal } from "react-dom";
import { getKapsoSetupLink } from "./adminApi.js";
import { canOfferSetupLink } from "./adminLogic.js";
import { KapsoSetupLinkDialog } from "./AdminDialogs.jsx";

const NO_ACT_TITLE = "Tu usuario puede ver Admin Spicy pero no hacer cambios. Pedile a un admin que te habilite las acciones.";

export default function KapsoSetupLinkButton({ app, canAct = true }) {
  const [open, setOpen] = useState(false);
  if (!canOfferSetupLink(app)) return null;
  return (
    <>
      <button type="button" className="btn-sm" disabled={!canAct} title={canAct ? "Ver el link para que el cliente termine de conectar su número" : NO_ACT_TITLE} onClick={(e) => { e.stopPropagation(); setOpen(true); }}>Ver link de conexión</button>
      {open && createPortal(<div onClick={(e) => e.stopPropagation()}><KapsoSetupLinkDialog app={app} onSubmit={() => getKapsoSetupLink(app._id)} onClose={() => setOpen(false)} /></div>, document.querySelector(".rv") || document.body)}
    </>
  );
}
