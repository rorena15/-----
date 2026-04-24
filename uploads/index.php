<?php
// 실제 서버에서 접근을 거부할 때 사용하는 403 상태 코드를 전송합니다.
header('HTTP/1.0 403 Forbidden');
?>
<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">
<html>

<head>
    <title>403 Forbidden</title>
</head>

<body>
    <h1>Forbidden</h1>
    <p>You don't have permission to access this resource.</p>
    <hr>
    <address>Apache Server at <?php echo $_SERVER['HTTP_HOST']; ?> Port 80</address>
</body>

</html>