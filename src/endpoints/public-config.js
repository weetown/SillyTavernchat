import express from 'express';
import { getConfigValue } from '../util.js';

export const router = express.Router();


router.get('/public-pages', (request, response) => {
    try {
        const enablePublicCharacters = getConfigValue('enablePublicCharacters', true, 'boolean');
        const enableForum = getConfigValue('enableForum', true, 'boolean');

        response.json({
            enablePublicCharacters,
            enableForum,
        });
    } catch (error) {
        console.error('Error getting public pages config:', error);
        response.status(500).json({ error: 'Failed to get public pages config' });
    }
});
