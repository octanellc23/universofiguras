import { setGlobalOptions } from 'firebase-functions/v2';

// Este módulo se importa ANTES que cualquier definición de función. Las
// opciones globales de Functions v2 se capturan en el momento en que se define
// cada función, así que si esto corriera después, no aplicaría a nada.
setGlobalOptions({
  // El dueño y la mayoría de los compradores están en la costa este.
  region: 'us-east1',
  // Techo de instancias: un video viral no debe poder generar una factura de
  // Cloud Run de cuatro cifras mientras nadie mira.
  maxInstances: 20,
});
