/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Type } from '@google/genai';

// Referencias a elementos del DOM
const form = document.getElementById('birthdate-form') as HTMLFormElement;
const birthdateInput = document.getElementById('birthdate-input') as HTMLInputElement;
const loader = document.getElementById('loader') as HTMLDivElement;
const resultContainer = document.getElementById('result-container') as HTMLDivElement;

// Comprobar si se encontraron todos los elementos
if (!form || !birthdateInput || !loader || !resultContainer) {
    throw new Error("No se encontraron los elementos del DOM requeridos.");
}

// Establecer la fecha máxima en el selector de fecha a hoy para prevenir fechas futuras
const today = new Date();
const yyyy = today.getFullYear();
const mm = String(today.getMonth() + 1).padStart(2, '0'); // Los meses son base 0
const dd = String(today.getDate()).padStart(2, '0');
const todayString = `${yyyy}-${mm}-${dd}`;
birthdateInput.max = todayString;

// Inicializar el cliente de GoogleGenAI
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Definir el esquema de respuesta JSON esperado del modelo
const responseSchema = {
    type: Type.OBJECT,
    properties: {
        movieTitle: {
            type: Type.STRING,
            description: "El título de la película."
        },
        description: {
            type: Type.STRING,
            description: "Una breve descripción o sinopsis de la película."
        },
        alternativeMovies: {
            type: Type.ARRAY,
            items: {
                type: Type.STRING
            },
            description: "Una lista de 1 a 2 películas populares alternativas del mismo mes y año."
        }
    },
    required: ["movieTitle", "description", "alternativeMovies"]
};

// Función para mostrar los resultados en el DOM
function displayResults(movieData: any) {
    let alternativesHtml = '';
    if (movieData.alternativeMovies && movieData.alternativeMovies.length > 0) {
        alternativesHtml = `
            <h3>Otras películas populares:</h3>
            <ul>
                ${movieData.alternativeMovies.map((movie: string) => `<li>${movie}</li>`).join('')}
            </ul>
        `;
    }

    resultContainer.innerHTML = `
        <h2>${movieData.movieTitle}</h2>
        <p>${movieData.description}</p>
        ${alternativesHtml}
    `;
    loader.classList.add('hidden');
    resultContainer.style.display = 'block';
}

// Gestionar el envío del formulario
form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const birthdateValue = birthdateInput.value;
    if (!birthdateValue) {
        resultContainer.style.display = 'block';
        resultContainer.innerHTML = `<p>Por favor, selecciona una fecha.</p>`;
        return;
    }

    // Validar que la fecha no sea en el futuro (refuerzo para el atributo max)
    if (birthdateValue > todayString) {
        resultContainer.style.display = 'block';
        resultContainer.innerHTML = `<p>Por favor, selecciona una fecha en el pasado.</p>`;
        return;
    }

    const birthdate = new Date(birthdateValue);
    // Añadir un día para manejar problemas de zona horaria
    birthdate.setDate(birthdate.getDate() + 1);

    const month = birthdate.toLocaleString('es-ES', { month: 'long' });
    const year = birthdate.getFullYear();
    const cacheKey = `movie-${month}-${year}`;

    // Primero, comprobar el caché
    const cachedResult = localStorage.getItem(cacheKey);
    if (cachedResult) {
        displayResults(JSON.parse(cachedResult));
        return;
    }

    // Si no está en caché, mostrar el cargador y hacer la llamada a la API
    loader.classList.remove('hidden');
    resultContainer.style.display = 'none';
    resultContainer.innerHTML = '';

    try {
        const prompt = `¿Cuál fue la película más famosa y culturalmente significativa estrenada en ${month} de ${year}? Proporciona el título de la película, una breve descripción de dos frases, y una lista de 1 a 2 películas populares alternativas de ese mismo mes y año.`;

        // Generar contenido con el esquema JSON especificado
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            },
        });

        // Parsear y guardar en caché
        const movieData = JSON.parse(response.text);
        localStorage.setItem(cacheKey, JSON.stringify(movieData));

        // Mostrar el resultado
        displayResults(movieData);

    } catch (error) {
        console.error("Error al obtener datos de la película:", error);
        resultContainer.innerHTML = `<p>Lo siento, no pude encontrar una película para esa fecha. Por favor, intenta con otra.</p>`;
    } finally {
        // Ocultar el cargador y mostrar el contenedor de resultados (si no se mostraron ya)
        loader.classList.add('hidden');
        resultContainer.style.display = 'block';
    }
});