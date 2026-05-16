export const getNetworkIp = (req, res) => {
    // PAULO: Aquí es donde tú "colocas" la IP que te dio el ipconfig
    // Ejemplo: const ipManual = '192.168.1.15';
    const ipManual = '192.168.1.XX'; 

    res.json({ 
        ip: ipManual
    });
};