import fs from 'fs';

const API_URL = 'https://finanzas-api.ubunifusoft.digital';

async function testTransactions() {
    try {
        console.log("Logging in...");
        const loginRes = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'alejandrogolo@ufps.edu.co', password: '123098aLe' })
        });
        
        let loginDataText = await loginRes.text();
        const loginData = JSON.parse(loginDataText);
        
        if (!loginData.data || !loginData.data.token) {
            console.error("Login failed:", loginData);
            return;
        }
        
        const token = loginData.data.token;
        const workspaceId = loginData.data.workspaces[0].id; // Should be 9
        console.log(`Token received. Workspace: ${workspaceId}`);
        
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        // Escenario 1: INGRESO EFECTIVO (El que fallaba) - Strict Swagger format
        const p1 = {
            workspaceId: workspaceId,
            tipo: "INGRESO",
            categoriaId: 91,
            beneficiarioId: 0,
            itemPresupuestoId: 0,
            fecha: "2026-03-20",
            monto: 15.5,
            descripcion: "Test Strict 1",
            medioPago: "EFECTIVO",
            cuentaId: 68,
            tarjetaCreditoId: 0
        };
        
        console.log('\n--- Test 1: EXACT MATCH to Swagger Example ---');
        console.log('Sending:', JSON.stringify(p1, null, 2));
        const res1 = await fetch(`${API_URL}/api/transactions`, { method: 'POST', headers, body: JSON.stringify(p1) });
        console.log('Status:', res1.status, await res1.text());

        // Escenario 2: INGRESO EFECTIVO - but with nulls
        const p2 = {
            workspaceId: workspaceId,
            tipo: "INGRESO",
            categoriaId: 91,
            fecha: "2026-03-20",
            monto: 16.5,
            descripcion: "Test Nulls 2",
            medioPago: "EFECTIVO",
            cuentaId: 68,
            tarjetaCreditoId: null,
            beneficiarioId: null,
            itemPresupuestoId: null
        };
        
        console.log('\n--- Test 2: WITH NULLS ---');
        console.log('Sending:', JSON.stringify(p2, null, 2));
        const res2 = await fetch(`${API_URL}/api/transactions`, { method: 'POST', headers, body: JSON.stringify(p2) });
        console.log('Status:', res2.status, await res2.text());

        // Escenario 3: INGRESO TRANSFERENCIA
        const p3 = {
            workspaceId: workspaceId,
            tipo: "INGRESO",
            categoriaId: 91,
            fecha: "2026-03-20",
            monto: 17.5,
            descripcion: "Test Transfer 3",
            medioPago: "TRANSFERENCIA",
            cuentaId: 68
        };
        
        console.log('\n--- Test 3: TRANSFERENCIA Missing Nulls ---');
        const res3 = await fetch(`${API_URL}/api/transactions`, { method: 'POST', headers, body: JSON.stringify(p3) });
        console.log('Status:', res3.status, await res3.text());

    } catch (e) {
        console.error("Test error:", e);
    }
}

testTransactions();
