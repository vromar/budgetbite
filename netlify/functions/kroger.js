// Kroger API Proxy for Netlify Functions

const KROGER_CLIENT_ID = 'budgetbite-omar-bbc91h50';
const KROGER_CLIENT_SECRET = 'xjoE9AFY5exlvc0zilq3HNOFVAedVaUm96jtG1la';

// Get access token from Kroger
async function getToken() {
    const credentials = Buffer.from(`${KROGER_CLIENT_ID}:${KROGER_CLIENT_SECRET}`).toString('base64');
    
    const response = await fetch('https://api.kroger.com/v1/connect/oauth2/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${credentials}`
        },
        body: 'grant_type=client_credentials&scope=product.compact'
    });

   if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get Kroger token: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.access_token;
}

// Main handler for Netlify
exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const params = event.queryStringParameters || {};
    const { action, term, locationId, zipCode } = params;

    try {
        const token = await getToken();

        // Test endpoint
        if (action === 'test') {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, message: 'Kroger API proxy is working!' })
            };
        }

        // Search for products
        if (action === 'search' && term) {
            let url = `https://api.kroger.com/v1/products?filter.term=${encodeURIComponent(term)}&filter.limit=1`;
            if (locationId) {
                url += `&filter.locationId=${locationId}`;
            }

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                return {
                    statusCode: response.status,
                    headers,
                    body: JSON.stringify({ error: 'Kroger API error' })
                };
            }

            const data = await response.json();
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(data)
            };
        }

        // Search for stores
        if (action === 'locations' && zipCode) {
            const response = await fetch(
                `https://api.kroger.com/v1/locations?filter.zipCode.near=${zipCode}&filter.limit=5`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                return {
                    statusCode: response.status,
                    headers,
                    body: JSON.stringify({ error: 'Kroger API error' })
                };
            }

            const data = await response.json();
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(data)
            };
        }

        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid action. Use ?action=search&term=milk or ?action=locations&zipCode=45202' })
        };

    } catch (error) {
        console.error('Kroger API error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
