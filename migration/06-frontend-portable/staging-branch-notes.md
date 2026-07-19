# Rama frontend staging — `chore/staging-cutover-dryrun`

## Objetivo

Rama aislada, no fusionable a `main`, que permite ejecutar el frontend
apuntando al proyecto Supabase staging externo. Se usa exclusivamente
para el dry run de la Fase 0.

## Reglas absolutas

- No se publica.
- No se mergea a `main`.
- No se despliega a la URL productiva.
- No contiene credenciales reales.
- Se elimina tras el corte productivo (Fase 1) o tras 60 días, lo que
  ocurra primero.

## Contenido específico de la rama

Cuando el operador clone el repo y cree la rama:

```bash
git checkout -b chore/staging-cutover-dryrun
```

Debe aplicar SOLO en esa rama los siguientes cambios:

1. **Reemplazar** los cuatro archivos generados por Lovable Cloud:

   | Origen (Lovable auto-gen)                     | Reemplazo (portable)                                  |
   |-----------------------------------------------|-------------------------------------------------------|
   | `src/integrations/supabase/client.ts`         | `migration/06-frontend-portable/client.ts`            |
   | `src/integrations/supabase/client.server.ts`  | `migration/06-frontend-portable/client.server.ts`     |
   | `src/integrations/supabase/auth-middleware.ts`| `migration/06-frontend-portable/auth-middleware.ts`   |
   | `src/integrations/supabase/auth-attacher.ts`  | `migration/06-frontend-portable/auth-attacher.ts`     |

   Comando:
   ```bash
   cp migration/06-frontend-portable/client.ts         src/integrations/supabase/client.ts
   cp migration/06-frontend-portable/client.server.ts  src/integrations/supabase/client.server.ts
   cp migration/06-frontend-portable/auth-middleware.ts src/integrations/supabase/auth-middleware.ts
   cp migration/06-frontend-portable/auth-attacher.ts  src/integrations/supabase/auth-attacher.ts
   ```

2. **Copiar** `.env.staging.template` a `.env.staging` y llenar con
   los valores del proyecto Supabase staging. Verificar:

   ```bash
   grep VITE_SUPABASE_URL .env.staging | grep -q "diqdpygummlrajsugotv" \
     && { echo "ABORT: .env.staging apunta a PROD"; exit 1; }
   ```

3. **Agregar el guard** en `src/main.tsx`:

   ```tsx
   import { assertStagingEnv, StagingBanner } from "./staging-guard";
   assertStagingEnv();

   // dentro del render root:
   <>
     <StagingBanner />
     <RouterProvider router={router} />
   </>
   ```

   Copiar `migration/06-frontend-portable/staging-guard.tsx` a
   `src/staging-guard.tsx` en esta rama.

4. **Regenerar tipos**:
   ```bash
   supabase gen types typescript --project-id "$TARGET_STAGING_PROJECT_REF" \
     > src/integrations/supabase/types.ts
   ```

5. **Build y dev**:
   ```bash
   bun install
   bun run build   # debe compilar sin errores
   bun run dev     # levantar en localhost:8080
   ```

## Guard adicional en el build

Añadir al `package.json` de esta rama un script `predev` y `prebuild`:

```json
{
  "scripts": {
    "predev": "node -e \"if(process.env.VITE_SUPABASE_URL?.includes('diqdpygummlrajsugotv'))process.exit(1)\"",
    "prebuild": "node -e \"if(process.env.VITE_SUPABASE_URL?.includes('diqdpygummlrajsugotv'))process.exit(1)\""
  }
}
```

## Al finalizar el dry run

- **NO** hacer merge de esta rama.
- Archivar la rama con un tag: `git tag staging-dryrun-$(date +%Y%m%d)`.
- Documentar hallazgos en `migration/07-cutover/reports/`.
- Preservar la rama para el corte productivo (Fase 1) o eliminarla si
  la Fase 1 se cancela.
