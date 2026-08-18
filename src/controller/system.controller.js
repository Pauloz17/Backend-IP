export const getNetworkIp = (req, res) => {
    const ipManual = '192.168.56.1';

    res.json({
        ip: ipManual,
    });
};